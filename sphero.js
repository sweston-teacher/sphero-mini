/*
 * Minimal Sphero Mini driver for Web Bluetooth.
 *
 * Speaks the "Sphero API v2" packet protocol used by the Mini
 * (also BOLT / R2-D2, but this file only targets what the Mini needs).
 *
 * Packet layout:  SOP FLAGS [TID] [SID] DID CID SEQ [ERR] DATA... CHK EOP
 *   SOP = 0x8D, EOP = 0xD8, CHK = ~(sum of everything between SOP and EOP) & 0xFF
 *   0x8D / 0xD8 / 0xAB inside the body are escaped as 0xAB 0x05 / 0xAB 0x50 / 0xAB 0x23
 */
(function (global) {
  'use strict';

  const API_SERVICE = '00010001-574f-4f20-5370-6865726f2121';
  const API_CHAR    = '00010002-574f-4f20-5370-6865726f2121';
  const DOS_SERVICE = '00020001-574f-4f20-5370-6865726f2121';
  const DOS_CHAR    = '00020005-574f-4f20-5370-6865726f2121';
  const DOS_PASSWORD = 'usetheforce...band';

  const SOP = 0x8d, EOP = 0xd8, ESC = 0xab;
  const ESC_SOP = 0x05, ESC_EOP = 0x50, ESC_ESC = 0x23;

  const FLAG = {
    isResponse: 0x01,
    requestsResponse: 0x02,
    requestsOnlyErrorResponse: 0x04,
    resetsInactivityTimeout: 0x08,
    hasTargetId: 0x10,
    hasSourceId: 0x20,
  };

  const DID = { apiAndShell: 0x10, power: 0x13, driving: 0x16, userIO: 0x1a };

  const CMD = {
    ping:              [DID.apiAndShell, 0x00],
    sleep:             [DID.power, 0x01],
    getBatteryVoltage: [DID.power, 0x03],
    wake:              [DID.power, 0x0d],
    resetYaw:          [DID.driving, 0x06],
    driveWithHeading:  [DID.driving, 0x07],
    setStabilization:  [DID.driving, 0x0c],
    setAllLeds:        [DID.userIO, 0x0e],
  };

  // LED bitmask values for the Mini's "set all LEDs" command.
  const LED_MASK_MAIN_RGB = 0x000e; // main body LED (R,G,B)
  const LED_MASK_BACK     = 0x0001; // small blue "aim" LED on the back

  function encodePacket(did, cid, seq, data, flags) {
    const body = [flags, did, cid, seq & 0xff, ...data];
    let sum = 0;
    for (const b of body) sum += b;
    body.push((~sum) & 0xff);

    const out = [SOP];
    for (const b of body) {
      if (b === SOP) out.push(ESC, ESC_SOP);
      else if (b === EOP) out.push(ESC, ESC_EOP);
      else if (b === ESC) out.push(ESC, ESC_ESC);
      else out.push(b);
    }
    out.push(EOP);
    return new Uint8Array(out);
  }

  // Turns a stream of incoming bytes into parsed packets.
  class PacketDecoder {
    constructor(onPacket) {
      this.onPacket = onPacket;
      this.buf = null;
      this.escaping = false;
    }
    push(bytes) {
      for (const b of bytes) {
        if (b === SOP) { this.buf = []; this.escaping = false; continue; }
        if (this.buf === null) continue;
        if (b === EOP) { this._finish(); continue; }
        if (b === ESC) { this.escaping = true; continue; }
        if (this.escaping) {
          this.escaping = false;
          if (b === ESC_SOP) this.buf.push(SOP);
          else if (b === ESC_EOP) this.buf.push(EOP);
          else if (b === ESC_ESC) this.buf.push(ESC);
          else { this.buf = null; } // malformed escape, drop packet
          continue;
        }
        this.buf.push(b);
      }
    }
    _finish() {
      const body = this.buf;
      this.buf = null;
      if (!body || body.length < 5) return;
      let sum = 0;
      for (let i = 0; i < body.length - 1; i++) sum += body[i];
      if (((~sum) & 0xff) !== body[body.length - 1]) return; // bad checksum

      let i = 0;
      const flags = body[i++];
      if (flags & FLAG.hasTargetId) i++;
      if (flags & FLAG.hasSourceId) i++;
      const did = body[i++];
      const cid = body[i++];
      const seq = body[i++];
      let err = 0;
      if (flags & FLAG.isResponse) err = body[i++];
      const data = body.slice(i, body.length - 1);
      this.onPacket({ flags, did, cid, seq, err, data, isResponse: !!(flags & FLAG.isResponse) });
    }
  }

  class SpheroMini extends EventTarget {
    constructor(device) {
      super();
      this.device = device;
      this.name = device.name || 'Sphero Mini';
      this.char = null;
      this.connected = false;
      this._seq = 0;
      this._queue = [];
      this._busy = false;
      this._pending = new Map(); // seq -> {resolve, reject, timer}
      this._decoder = new PacketDecoder((p) => this._onPacket(p));
      this._onValue = (e) => {
        const v = e.target.value;
        this._decoder.push(new Uint8Array(v.buffer, v.byteOffset, v.byteLength));
      };
      this._onDisconnected = () => {
        this.connected = false;
        this._queue.length = 0;
        for (const p of this._pending.values()) { clearTimeout(p.timer); p.reject(new Error('disconnected')); }
        this._pending.clear();
        this.dispatchEvent(new Event('disconnected'));
      };
    }

    static get supported() { return !!(navigator.bluetooth && navigator.bluetooth.requestDevice); }

    // Opens the browser's device chooser filtered to Sphero Minis ("SM-xxxx").
    static async request() {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: 'SM-' }],
        optionalServices: [API_SERVICE, DOS_SERVICE],
      });
      return new SpheroMini(device);
    }

    async connect() {
      this.device.removeEventListener('gattserverdisconnected', this._onDisconnected);
      this.device.addEventListener('gattserverdisconnected', this._onDisconnected);
      this._decoder.buf = null;
      const server = await this.device.gatt.connect();

      // The Mini refuses API commands until this magic string is written.
      const dosService = await server.getPrimaryService(DOS_SERVICE);
      const dosChar = await dosService.getCharacteristic(DOS_CHAR);
      await dosChar.writeValue(new TextEncoder().encode(DOS_PASSWORD));

      const apiService = await server.getPrimaryService(API_SERVICE);
      this.char = await apiService.getCharacteristic(API_CHAR);
      this.char.removeEventListener('characteristicvaluechanged', this._onValue);
      this.char.addEventListener('characteristicvaluechanged', this._onValue);
      await this.char.startNotifications();

      this.connected = true;
      await this.wake();
    }

    async disconnect() {
      if (this.device.gatt.connected) this.device.gatt.disconnect();
    }

    // ---- commands -------------------------------------------------------

    wake()  { return this._send(CMD.wake, [], { wait: true }); }
    sleep() { return this._send(CMD.sleep, [], { wait: true }); }
    ping()  { return this._send(CMD.ping, [], { wait: true }); }

    async getBatteryVoltage() {
      const res = await this._send(CMD.getBatteryVoltage, [], { wait: true });
      if (!res || res.data.length < 2) return null;
      return ((res.data[0] << 8) | res.data[1]) / 100; // volts
    }

    setColor(r, g, b) {
      return this._send(CMD.setAllLeds, [LED_MASK_MAIN_RGB >> 8, LED_MASK_MAIN_RGB & 0xff, r & 0xff, g & 0xff, b & 0xff], { key: 'color' });
    }

    setBackLed(brightness) {
      return this._send(CMD.setAllLeds, [LED_MASK_BACK >> 8, LED_MASK_BACK & 0xff, brightness & 0xff], { key: 'backled' });
    }

    // speed 0-255, heading 0-359 (relative to the last "aim"), reverse=true drives backwards
    drive(speed, heading, reverse = false) {
      speed = Math.max(0, Math.min(255, Math.round(speed)));
      heading = ((Math.round(heading) % 360) + 360) % 360;
      return this._send(CMD.driveWithHeading, [speed, (heading >> 8) & 0xff, heading & 0xff, reverse ? 1 : 0], { key: 'drive' });
    }

    stop(heading = 0) { return this.drive(0, heading); }

    resetYaw() { return this._send(CMD.resetYaw, [], { wait: true }); }

    setStabilization(on) { return this._send(CMD.setStabilization, [on ? 1 : 0]); }

    // ---- internals ------------------------------------------------------

    _send(cmd, data, opts = {}) {
      if (!this.connected || !this.char) return Promise.reject(new Error('not connected'));
      const [did, cid] = cmd;
      return new Promise((resolve, reject) => {
        const item = { did, cid, data, wait: !!opts.wait, key: opts.key || null, resolve, reject };
        // Coalesce: if an identical-key command is still waiting in the queue, replace it
        // (e.g. many drive updates arriving faster than BLE can send them).
        if (item.key) {
          const idx = this._queue.findIndex((q) => q.key === item.key);
          if (idx >= 0) { this._queue[idx].resolve(null); this._queue.splice(idx, 1); }
        }
        this._queue.push(item);
        this._pump();
      });
    }

    async _pump() {
      if (this._busy) return;
      this._busy = true;
      while (this._queue.length) {
        const item = this._queue.shift();
        if (!this.connected) { item.reject(new Error('disconnected')); continue; }
        const seq = this._seq = (this._seq + 1) & 0xff;
        const flags = FLAG.requestsResponse | FLAG.resetsInactivityTimeout;
        const packet = encodePacket(item.did, item.cid, seq, item.data, flags);
        let responsePromise = null;
        if (item.wait) {
          responsePromise = new Promise((resolve, reject) => {
            const timer = setTimeout(() => { this._pending.delete(seq); reject(new Error('timeout')); }, 3000);
            this._pending.set(seq, { resolve, reject, timer });
          });
        }
        try {
          if (this.char.properties.writeWithoutResponse) await this.char.writeValueWithoutResponse(packet);
          else await this.char.writeValue(packet);
          if (responsePromise) item.resolve(await responsePromise);
          else item.resolve(null);
        } catch (err) {
          item.reject(err);
        }
      }
      this._busy = false;
    }

    _onPacket(p) {
      if (p.isResponse) {
        const pending = this._pending.get(p.seq);
        if (pending) {
          this._pending.delete(p.seq);
          clearTimeout(pending.timer);
          if (p.err) pending.reject(new Error(`robot error 0x${p.err.toString(16)}`));
          else pending.resolve(p);
        }
      }
      this.dispatchEvent(new CustomEvent('packet', { detail: p }));
    }
  }

  SpheroMini.encodePacket = encodePacket;
  SpheroMini.PacketDecoder = PacketDecoder;
  global.SpheroMini = SpheroMini;
})(typeof window !== 'undefined' ? window : globalThis);
