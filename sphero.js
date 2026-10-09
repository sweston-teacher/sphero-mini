/*
 * Minimal Sphero Mini driver for Web Bluetooth.
 *
 * Speaks the "Sphero API v2" packet protocol used by the Mini, the BOLT and the BOLT+.
 *   Mini  (SM-xxxx): needs the unlock string, one processor, battery as voltage.
 *   BOLT  (SB-xxxx): needs the unlock string, two processors, so packets carry a target ID. (Not yet tested on a real ball.)
 *   BOLT+ (BP-xxxx): no unlock service, answers on its main processor without a target ID,
 *                    battery as a percentage. Tested on real BP- balls 2026-10-09.
 *                    Full notes: docs/BOLT_PLUS_PROTOCOL.md
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

  const DID = { apiAndShell: 0x10, power: 0x13, driving: 0x16, sensor: 0x18, userIO: 0x1a };

  const CMD = {
    ping:              [DID.apiAndShell, 0x00],
    sleep:             [DID.power, 0x01],
    getBatteryVoltage: [DID.power, 0x03],
    getBatteryPercent: [DID.power, 0x10], // BOLT+
    driveRCNormalized: [DID.driving, 0x35], // BOLT+: turn rate + speed
    // Sensor commands (DID 0x18), numbers from the spherov2 library's command list for the BOLT.
    magCalibrateToNorth: [0x18, 0x25],    // spins to find north; answers with a 0x26 notification
    wake:              [DID.power, 0x0d],
    resetYaw:          [DID.driving, 0x06],
    driveWithHeading:  [DID.driving, 0x07],
    setStabilization:  [DID.driving, 0x0c],
    setStabilizationBP:[DID.driving, 0x51], // BOLT+ (0x0c does not exist there)
    setAllLeds:        [DID.userIO, 0x0e],
    setAllLeds32:      [DID.userIO, 0x1a], // BOLT: 32-bit LED mask
    matrixFillColor:   [DID.userIO, 0x2f], // BOLT: whole 8x8 matrix one color
  };

  // BOLT: which processor handles each device ID. 0x11 = primary (Bluetooth/power), 0x12 = secondary (motors, sensors, LEDs).
  const BOLT_TARGETS = { [DID.apiAndShell]: 0x11, [DID.power]: 0x11, [DID.driving]: 0x12, [DID.userIO]: 0x12 };
  // Original BOLT LED bits (from the spherov2 library, not tested on a real BOLT).
  const BOLT_LED_FRONT = 0x07; // front R,G,B
  const BOLT_LED_BACK  = 0x38; // back R,G,B

  // BOLT+: 6 RGB LEDs = 18 channels. Recorded from Sphero Edu's set*Led functions (docs/BOLT_PLUS_PROTOCOL.md).
  const BP_LED_ALL = 0x3ffff;
  const BP_BACK_BLUE_CHANNEL = 5; // back LED is channels 3-5 (R,G,B)

  // BOLT+ screen (DID 0x15). Recorded from Sphero Edu.
  const SCREEN = { fill: [0x15, 0x02], clear: [0x15, 0x07], showAsset: [0x15, 0x10] };
  const SCREEN_ASSET = { defaultFace: 0x0a, aim: 0x02 };

  const NAME_PREFIX = { mini: 'SM-', bolt: 'SB-', boltplus: 'BP-' };
  const BLE_CHUNK = 20; // the BOLT+ silently drops writes longer than this, so long packets are sent in pieces

  function modelFromName(name) {
    if (name.startsWith('BP-')) return 'boltplus';
    if (name.startsWith('SB-')) return 'bolt';
    return 'mini';
  }

  // LED bitmask values for the Mini's "set all LEDs" command.
  const LED_MASK_MAIN_RGB = 0x000e; // main body LED (R,G,B)
  const LED_MASK_BACK     = 0x0001; // small blue "aim" LED on the back

  function encodePacket(did, cid, seq, data, flags, tid = null, sid = null) {
    const route = [];
    if (tid != null) { flags |= FLAG.hasTargetId; route.push(tid); }
    if (sid != null) { flags |= FLAG.hasSourceId; route.push(sid); }
    const body = [flags, ...route, did, cid, seq & 0xff, ...data];
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
      this.name = device.name || 'Sphero';
      this.model = modelFromName(this.name);
      this.targets = this.model === 'bolt' ? { ...BOLT_TARGETS } : null;
      this.sourceId = null;
      this.log = []; // last packets sent/received, for debugging
      this._color = [0, 0, 0];
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

    // Opens the browser's device chooser, listing only the given models (default: all of them).
    static async request(models = Object.keys(NAME_PREFIX)) {
      const device = await navigator.bluetooth.requestDevice({
        filters: models.map((m) => ({ namePrefix: NAME_PREFIX[m] })),
        optionalServices: [API_SERVICE, DOS_SERVICE],
      });
      return new SpheroMini(device);
    }

    async connect() {
      this.device.removeEventListener('gattserverdisconnected', this._onDisconnected);
      this.device.addEventListener('gattserverdisconnected', this._onDisconnected);
      this._decoder.buf = null;
      const server = await this.device.gatt.connect();

      // The Mini and BOLT refuse API commands until this magic string is written. The BOLT+ has no such service.
      if (this.model !== 'boltplus') {
        const dosService = await server.getPrimaryService(DOS_SERVICE);
        const dosChar = await dosService.getCharacteristic(DOS_CHAR);
        await dosChar.writeValue(new TextEncoder().encode(DOS_PASSWORD));
      }

      const apiService = await server.getPrimaryService(API_SERVICE);
      this.char = await apiService.getCharacteristic(API_CHAR);
      this.char.removeEventListener('characteristicvaluechanged', this._onValue);
      this.char.addEventListener('characteristicvaluechanged', this._onValue);
      await this.char.startNotifications();

      this.connected = true;
      await this.wake();
      // Sphero Edu switches stabilization OFF whenever a program ends, leaving the ball limp. Turn it back on.
      if (this.model === 'boltplus') await this._send(CMD.setStabilizationBP, [1], { wait: true });
    }

    async disconnect() {
      if (this.device.gatt.connected) this.device.gatt.disconnect();
    }

    // ---- commands -------------------------------------------------------

    wake()  { return this._send(CMD.wake, [], { wait: true }); }
    sleep() { return this._send(CMD.sleep, [], { wait: true }); }
    ping()  { return this._send(CMD.ping, [], { wait: true }); }

    async getBatteryVoltage() {
      if (this.model === 'boltplus') return null; // only reports a percentage
      const res = await this._send(CMD.getBatteryVoltage, [], { wait: true });
      if (!res || res.data.length < 2) return null;
      return ((res.data[0] << 8) | res.data[1]) / 100; // volts
    }

    async getBatteryPercent() {
      if (this.model !== 'boltplus') return null;
      const res = await this._send(CMD.getBatteryPercent, [], { wait: true });
      return res && res.data.length ? res.data[0] : null;
    }

    setColor(r, g, b) {
      r &= 0xff; g &= 0xff; b &= 0xff;
      this._color = [r, g, b];
      if (this.model === 'boltplus') {
        // All six lights and the whole screen show the color, so students can spot their ball from across the room.
        const leds = this._send(CMD.setAllLeds32, this._bpLeds((ch) => [r, g, b][ch % 3]), { key: 'color' });
        const screen = this._send(SCREEN.fill, [r, g, b], { key: 'screen' });
        return Promise.all([leds, screen]);
      }
      if (this.model === 'bolt') {
        // Front light and the whole LED matrix show the color.
        const front = this._send(CMD.setAllLeds32, [0, 0, 0, BOLT_LED_FRONT, r, g, b], { key: 'color' });
        const matrix = this._send(CMD.matrixFillColor, [r, g, b], { key: 'matrix' });
        return Promise.all([front, matrix]);
      }
      return this._send(CMD.setAllLeds, [LED_MASK_MAIN_RGB >> 8, LED_MASK_MAIN_RGB & 0xff, r, g, b], { key: 'color' });
    }

    setBackLed(brightness) {
      brightness &= 0xff;
      if (this.model === 'boltplus') {
        // Aiming, like Sphero Edu: every light off except a blue back light, and the aim picture on the screen.
        // When aiming ends, the ball's color comes back on all lights and the screen.
        if (!brightness) return this.setColor(...this._color);
        const leds = this._send(CMD.setAllLeds32, this._bpLeds((ch) => (ch === BP_BACK_BLUE_CHANNEL ? brightness : 0)), { key: 'color' });
        const screen = this._send(SCREEN.showAsset, [0, 0, 0, SCREEN_ASSET.aim, 1], { key: 'screen' });
        return Promise.all([leds, screen]);
      }
      if (this.model === 'bolt') {
        // Blue while aiming; otherwise the back light goes back to showing the ball's color.
        const back = brightness ? [0, 0, brightness] : (this.model === 'boltplus' ? this._color : [0, 0, 0]);
        return this._send(CMD.setAllLeds32, [0, 0, 0, BOLT_LED_BACK, ...back], { key: 'backled' });
      }
      return this._send(CMD.setAllLeds, [LED_MASK_BACK >> 8, LED_MASK_BACK & 0xff, brightness], { key: 'backled' });
    }

    // Debugging: send any command and wait for the reply. opts.tid / opts.sid override routing.
    raw(did, cid, data = [], opts = {}) { return this._send([did, cid], data, { wait: true, ...opts }); }

    // speed 0-255, heading 0-359 (relative to the last "aim"), reverse=true drives backwards
    drive(speed, heading, reverse = false) {
      speed = Math.max(0, Math.min(255, Math.round(speed)));
      heading = ((Math.round(heading) % 360) + 360) % 360;
      return this._send(CMD.driveWithHeading, [speed, (heading >> 8) & 0xff, heading & 0xff, reverse ? 1 : 0], { key: 'drive' });
    }

    stop(heading = 0) { return this.drive(0, heading); }

    // BOLT+ car-style driving: turn rate and forward speed, each -127..127 (positive turn = left).
    // Unlike drive(), this has no heading to swing toward, so the ball turns as fast as asked.
    driveRC(turn, speed) {
      const clamp = (v) => Math.max(-127, Math.min(127, Math.round(v))) & 0xff;
      return this._send(CMD.driveRCNormalized, [clamp(turn), clamp(speed), 0], { key: 'drive' });
    }

    resetYaw() { return this._send(CMD.resetYaw, [], { wait: true }); }

    setStabilization(on) {
      return this._send(this.model === 'boltplus' ? CMD.setStabilizationBP : CMD.setStabilization, [on ? 1 : 0]);
    }

    // BOLT+: 32-bit mask covering all 18 channels, then one value per channel from valueFor(channel).
    _bpLeds(valueFor) {
      const values = Array.from({ length: 18 }, (_, ch) => valueFor(ch) & 0xff);
      return [(BP_LED_ALL >>> 24) & 0xff, (BP_LED_ALL >>> 16) & 0xff, (BP_LED_ALL >>> 8) & 0xff, BP_LED_ALL & 0xff, ...values];
    }

    // ---- internals ------------------------------------------------------

    _send(cmd, data, opts = {}) {
      if (!this.connected || !this.char) return Promise.reject(new Error('not connected'));
      const [did, cid] = cmd;
      return new Promise((resolve, reject) => {
        const tid = 'tid' in opts ? opts.tid : (this.targets ? this.targets[did] : null);
        const sid = 'sid' in opts ? opts.sid : this.sourceId;
        const item = { did, cid, data, tid, sid, wait: !!opts.wait, key: opts.key || null, resolve, reject };
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
        const packet = encodePacket(item.did, item.cid, seq, item.data, flags, item.tid, item.sid);
        this._logPacket('out', packet);
        let responsePromise = null;
        if (item.wait) {
          responsePromise = new Promise((resolve, reject) => {
            const timer = setTimeout(() => { this._pending.delete(seq); reject(new Error('timeout')); }, 3000);
            this._pending.set(seq, { resolve, reject, timer });
          });
        }
        try {
          for (let i = 0; i < packet.length; i += BLE_CHUNK) {
            const piece = packet.subarray(i, i + BLE_CHUNK);
            if (this.char.properties.writeWithoutResponse) await this.char.writeValueWithoutResponse(piece);
            else await this.char.writeValue(piece);
          }
          if (responsePromise) item.resolve(await responsePromise);
          else item.resolve(null);
        } catch (err) {
          item.reject(err);
        }
      }
      this._busy = false;
    }

    _logPacket(dir, bytes) {
      this.log.push(dir + ' ' + [...bytes].map((b) => b.toString(16).padStart(2, '0')).join(' '));
      if (this.log.length > 60) this.log.shift();
    }

    _onPacket(p) {
      this._logPacket('in ', [p.flags, p.did, p.cid, p.seq, p.err, ...p.data]);
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
