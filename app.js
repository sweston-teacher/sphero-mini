/* Sphero Drive — UI + input handling. Talks to robots through sphero.js (window.SpheroMini). */
(function () {
  'use strict';

  const $ = (sel) => document.querySelector(sel);

  // Each connected Sphero gets the first unused color here, so students can tell them apart
  // by simply looking at the ball. The card in the list glows the same color.
  const PALETTE = [
    { name: 'Red',    hex: '#ff3b30' },
    { name: 'Blue',   hex: '#2f7bff' },
    { name: 'Green',  hex: '#34c759' },
    { name: 'Yellow', hex: '#ffd60a' },
    { name: 'Purple', hex: '#bf5af2' },
    { name: 'Orange', hex: '#ff9500' },
    { name: 'Pink',   hex: '#ff2d95' },
    { name: 'Cyan',   hex: '#32e0e0' },
    { name: 'White',  hex: '#ffffff' },
  ];

  const robots = [];        // { robot, id, nick, customNick, color, colorName, status, battery, el }
  let active = null;
  let maxSpeed = 120;

  // ---------------------------------------------------------------- helpers
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const hexToRgb = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const paletteName = (hex) => (PALETTE.find((p) => p.hex.toLowerCase() === hex.toLowerCase()) || {}).name;

  function toast(msg, kind = '', ms = 4000) {
    const el = document.createElement('div');
    el.className = 'toast ' + kind;
    el.textContent = msg;
    $('#toasts').appendChild(el);
    setTimeout(() => el.remove(), ms);
  }

  const nickKey = (id) => 'spheroNick:' + id;
  const loadNick = (id) => { try { return localStorage.getItem(nickKey(id)); } catch { return null; } };
  const saveNick = (id, nick) => { try { localStorage.setItem(nickKey(id), nick); } catch {} };

  // ---------------------------------------------------------------- status banner
  function updateBanner() {
    const banner = $('#banner'), text = $('#bannerText');
    const ok = robots.filter((r) => r.status === 'ok').length;
    const lost = robots.filter((r) => r.status === 'bad').length;
    banner.className = '';
    if (!robots.length) {
      text.textContent = 'No Sphero connected';
    } else if (active && active.status === 'connecting') {
      banner.classList.add('warn');
      text.textContent = `Connecting to ${active.nick}…`;
    } else if (active && active.status === 'bad') {
      text.textContent = `${active.nick} disconnected — shake it and press Reconnect`;
    } else if (active) {
      banner.classList.add('ok');
      text.textContent = `Connected — driving ${active.nick}` + (ok > 1 ? ` (${ok} connected)` : '') + (lost ? ` · ${lost} lost` : '');
    } else {
      text.textContent = 'No Sphero selected';
    }
    $('#driveWho').textContent = active ? `— ${active.nick}` : '';
    const canDrive = active && active.status === 'ok';
    $('#stickOverlay').hidden = !!canDrive;
    $('#stick').classList.toggle('dead', !canDrive);
    if (!canDrive) $('#stickOverlay').textContent = robots.length ? 'Pick a connected Sphero to drive' : 'Connect a Sphero to start driving';
  }

  // ---------------------------------------------------------------- robot cards
  function renderCard(entry) {
    if (!entry.el) {
      const el = document.createElement('div');
      el.className = 'robot';
      el.innerHTML = `
        <span class="drivetag">Driving</span>
        <div class="top">
          <span class="swatch"></span>
          <span class="name" title="Click to rename"></span>
        </div>
        <div class="status"><span class="dot"></span><span class="statusText"></span></div>
        <div class="meta"><span class="id"></span> · <span class="batt">🔋 —</span></div>
        <div class="actions">
          <button data-act="blink">✨ Blink</button>
          <button data-act="reconnect" class="primary">🔄 Reconnect</button>
          <button data-act="sleep">💤 Sleep</button>
          <button data-act="disconnect" class="danger">✕ Remove</button>
        </div>`;
      el.addEventListener('click', (e) => {
        if (e.target.closest('button, input')) return;
        setActive(entry);
      });
      el.querySelector('.name').addEventListener('click', () => editNick(entry));
      el.querySelector('[data-act=blink]').addEventListener('click', () => blink(entry));
      el.querySelector('[data-act=reconnect]').addEventListener('click', () => reconnect(entry));
      el.querySelector('[data-act=sleep]').addEventListener('click', () => sleepRobot(entry));
      el.querySelector('[data-act=disconnect]').addEventListener('click', () => removeRobot(entry));
      entry.el = el;
      $('#robots').appendChild(el);
    }
    const el = entry.el;
    el.style.setProperty('--robot-color', entry.color);
    el.classList.toggle('active', entry === active);
    el.classList.toggle('dead', entry.status === 'bad');
    if (!el.querySelector('.name input')) el.querySelector('.name').textContent = `${robots.indexOf(entry) + 1}. ${entry.nick}`;
    el.querySelector('.id').textContent = entry.robot.name;
    const st = el.querySelector('.status');
    st.className = 'status ' + ({ ok: 'ok', connecting: 'busy', bad: 'bad' }[entry.status]);
    el.querySelector('.statusText').textContent = { ok: 'Connected', connecting: 'Connecting…', bad: 'Disconnected' }[entry.status];
    el.querySelector('.batt').textContent = entry.battery == null ? '🔋 —' : `🔋 ${entry.battery.pct}% (${entry.battery.volts.toFixed(2)} V)`;
    el.querySelector('[data-act=reconnect]').style.display = entry.status === 'bad' ? '' : 'none';
    el.querySelector('[data-act=blink]').disabled = entry.status !== 'ok';
    el.querySelector('[data-act=sleep]').disabled = entry.status !== 'ok';
    $('#noRobots').style.display = robots.length ? 'none' : '';
  }
  function renderAll() { robots.forEach(renderCard); updateBanner(); updateSwatches(); }

  function editNick(entry) {
    const nameEl = entry.el.querySelector('.name');
    if (nameEl.querySelector('input')) return;
    const input = document.createElement('input');
    input.type = 'text'; input.value = entry.nick; input.maxLength = 20;
    nameEl.textContent = ''; nameEl.appendChild(input); input.focus(); input.select();
    const done = () => {
      const v = input.value.trim();
      if (v) { entry.nick = v; entry.customNick = true; saveNick(entry.id, v); }
      input.remove();
      renderAll();
    };
    input.addEventListener('blur', done);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); if (e.key === 'Escape') { input.value = entry.nick; input.blur(); } e.stopPropagation(); });
  }

  function setActive(entry) {
    active = entry;
    renderAll();
  }

  // ---------------------------------------------------------------- connecting
  function pickColor() {
    const used = new Set(robots.map((r) => r.color.toLowerCase()));
    return PALETTE.find((p) => !used.has(p.hex.toLowerCase())) || PALETTE[robots.length % PALETTE.length];
  }

  async function connectNew() {
    let robot;
    try {
      robot = await SpheroMini.request();
    } catch (err) {
      if (err.name === 'NotFoundError') return; // user closed the chooser
      toast('Could not open the Bluetooth chooser: ' + err.message, 'bad');
      return;
    }
    let entry = robots.find((r) => r.id === robot.device.id);
    if (entry) {
      toast(`${entry.nick} is already in the list — reconnecting it.`);
      return reconnect(entry);
    }
    const c = pickColor();
    const saved = loadNick(robot.device.id);
    entry = { robot, id: robot.device.id, nick: saved || c.name, customNick: !!saved, color: c.hex, colorName: c.name, status: 'connecting', battery: null, el: null };
    robots.push(entry);
    if (!active) active = entry;
    robot.addEventListener('disconnected', () => onDropped(entry));
    renderAll();
    await doConnect(entry);
  }

  async function doConnect(entry) {
    entry.status = 'connecting';
    renderAll();
    try {
      await entry.robot.connect();
      entry.status = 'ok';
      renderAll();
      const [r, g, b] = hexToRgb(entry.color);
      await entry.robot.setColor(r, g, b);
      toast(`${entry.nick} is connected! Look for the ${entry.colorName.toLowerCase()} light.`, 'ok');
      blink(entry);
      refreshBattery(entry);
      if (!active || active.status !== 'ok') setActive(entry);
    } catch (err) {
      console.error(err);
      entry.status = 'bad';
      renderAll();
      toast(`Couldn't connect to ${entry.nick}. Shake it until it lights up, then press Reconnect.`, 'bad', 6000);
    }
  }

  async function reconnect(entry) {
    if (entry.status === 'connecting') return;
    await doConnect(entry);
  }

  async function onDropped(entry) {
    if (entry.status === 'removed') return;
    entry.status = 'bad';
    entry.battery = null;
    renderAll();
    // One quiet retry: Minis sometimes drop for a moment.
    await sleep(1500);
    if (entry.status !== 'bad') return;
    try {
      entry.status = 'connecting'; renderAll();
      await entry.robot.connect();
      entry.status = 'ok'; renderAll();
      const [r, g, b] = hexToRgb(entry.color);
      await entry.robot.setColor(r, g, b);
      toast(`${entry.nick} reconnected.`, 'ok');
    } catch {
      entry.status = 'bad'; renderAll();
      toast(`${entry.nick} disconnected. Is it asleep or on the charger? Shake it and press Reconnect.`, 'bad', 7000);
    }
  }

  async function removeRobot(entry) {
    entry.status = 'removed';
    try { await entry.robot.disconnect(); } catch {}
    robots.splice(robots.indexOf(entry), 1);
    entry.el.remove();
    if (active === entry) active = robots.find((r) => r.status === 'ok') || robots[0] || null;
    renderAll();
  }

  async function sleepRobot(entry) {
    try { await entry.robot.sleep(); toast(`${entry.nick} is going to sleep. Shake it to wake it up.`); } catch (e) { toast(e.message, 'bad'); }
  }

  async function blink(entry) {
    if (entry.status !== 'ok' || entry.blinking) return;
    entry.blinking = true;
    const [r, g, b] = hexToRgb(entry.color);
    try {
      for (let i = 0; i < 4; i++) {
        await entry.robot.setColor(0, 0, 0); await sleep(150);
        await entry.robot.setColor(255, 255, 255); await sleep(150);
      }
      await entry.robot.setColor(r, g, b);
    } catch {}
    entry.blinking = false;
  }

  async function refreshBattery(entry) {
    if (entry.status !== 'ok') return;
    try {
      const volts = await entry.robot.getBatteryVoltage();
      if (volts != null) {
        const pct = Math.round(Math.max(0, Math.min(1, (volts - 3.55) / (4.15 - 3.55))) * 100);
        entry.battery = { volts, pct };
        renderCard(entry);
      }
    } catch {}
  }
  setInterval(() => robots.forEach(refreshBattery), 30000); // also keeps the Mini awake

  // ---------------------------------------------------------------- color
  function updateSwatches() {
    const sw = $('#swatches');
    sw.querySelectorAll('button').forEach((b) => b.remove());
    for (const p of PALETTE) {
      const b = document.createElement('button');
      b.style.background = p.hex; b.title = p.name;
      b.classList.toggle('sel', !!active && active.color.toLowerCase() === p.hex.toLowerCase());
      b.addEventListener('click', () => applyColor(p.hex));
      sw.insertBefore(b, $('#colorPick'));
    }
    if (active) $('#colorPick').value = active.color;
  }

  function applyColor(hex) {
    if (!active || active.status !== 'ok') { toast('Connect a Sphero first.'); return; }
    active.color = hex;
    const name = paletteName(hex);
    active.colorName = name || 'Custom';
    if (!active.customNick) active.nick = name || 'Custom';
    const [r, g, b] = hexToRgb(hex);
    active.robot.setColor(r, g, b).catch(() => {});
    renderAll();
  }

  function cycleColor(dir) {
    if (!active) return;
    const i = PALETTE.findIndex((p) => p.hex.toLowerCase() === active.color.toLowerCase());
    const next = PALETTE[((i < 0 ? 0 : i + dir) + PALETTE.length) % PALETTE.length];
    applyColor(next.hex);
  }

  $('#colorPick').addEventListener('input', (e) => applyColor(e.target.value));

  // ---------------------------------------------------------------- inputs
  const keys = new Set();
  window.addEventListener('keydown', (e) => {
    if (e.target && e.target.matches && e.target.matches('input, textarea')) return;
    const k = e.key.toLowerCase();
    if (/^[1-9]$/.test(k)) { const r = robots[+k - 1]; if (r) setActive(r); return; }
    if (k === 'b') { if (active) blink(active); return; }
    if (k === ' ') { e.preventDefault(); stopNow(); return; }
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd', 'shift'].includes(k)) { e.preventDefault(); keys.add(k); }
  });
  window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => { keys.clear(); stopNow(); });

  function keyboardVector() {
    let x = 0, y = 0;
    if (keys.has('arrowup') || keys.has('w')) y += 1;
    if (keys.has('arrowdown') || keys.has('s')) y -= 1;
    if (keys.has('arrowleft') || keys.has('a')) x -= 1;
    if (keys.has('arrowright') || keys.has('d')) x += 1;
    const m = Math.hypot(x, y);
    return m ? { x: x / m, y: y / m, turbo: keys.has('shift') } : null;
  }

  // On-screen joystick
  const stick = $('#stick'), knob = $('#knob');
  let joy = null; // {x, y} with y up = forward
  stick.addEventListener('pointerdown', (e) => {
    if (!active || active.status !== 'ok') return;
    stick.setPointerCapture(e.pointerId);
    joy = { x: 0, y: 0 };
    moveJoy(e);
  });
  stick.addEventListener('pointermove', (e) => { if (joy) moveJoy(e); });
  const endJoy = () => { joy = null; };
  stick.addEventListener('pointerup', endJoy);
  stick.addEventListener('pointercancel', endJoy);
  stick.addEventListener('lostpointercapture', endJoy);
  function moveJoy(e) {
    const r = stick.getBoundingClientRect();
    const radius = r.width / 2 - 46;
    let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const m = Math.hypot(dx, dy);
    if (m > radius) { dx *= radius / m; dy *= radius / m; }
    joy = { x: dx / radius, y: -dy / radius };
  }
  function showKnob(v) {
    let x = 0, y = 0;
    if (v) {
      const r = stick.getBoundingClientRect();
      const radius = r.width / 2 - 46;
      const m = Math.hypot(v.x, v.y) || 1;
      const mag = Math.min(1, m);
      x = (v.x / m) * mag * radius;
      y = (-v.y / m) * mag * radius;
    }
    knob.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
  }

  // Real gamepads
  const padPrev = {};
  function gamepadVector() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let pad = null;
    for (const p of pads) if (p && p.connected) { pad = p; break; }
    const chip = $('#padChip');
    chip.classList.toggle('on', !!pad);
    chip.textContent = pad ? 'Gamepad: ' + (pad.id.split('(')[0].trim().slice(0, 24) || 'connected') : 'Gamepad: none';
    if (!pad) return null;

    // edge-triggered buttons
    const pressed = (i) => !!(pad.buttons[i] && pad.buttons[i].pressed);
    const edge = (i) => { const now = pressed(i), was = !!padPrev[i]; padPrev[i] = now; return now && !was; };
    if (edge(4)) cycleColor(-1);
    if (edge(5)) cycleColor(1);
    if (edge(0) && active) blink(active);

    let x = pad.axes[0] || 0, y = -(pad.axes[1] || 0);
    if (pressed(12)) y = 1; if (pressed(13)) y = -1; if (pressed(14)) x = -1; if (pressed(15)) x = 1;
    const m = Math.hypot(x, y);
    if (m < 0.15) return null;
    const scale = Math.min(1, (m - 0.15) / 0.85) / m; // dead zone, then ramp to full
    return { x: x * scale, y: y * scale, turbo: pressed(7) };
  }

  // ---------------------------------------------------------------- drive loop
  let lastHeading = 0, moving = false;
  let aimMode = false, aimHeading = 0, aimSent = null;

  function stopNow() {
    moving = false;
    if (active && active.status === 'ok') active.robot.drive(0, lastHeading).catch(() => {});
  }

  function tick() {
    const v = joy || gamepadVector() || keyboardVector();
    showKnob(v);
    if (!active || active.status !== 'ok') return;

    if (aimMode) {
      if (v) aimHeading = (aimHeading + v.x * 5 + 360) % 360;
      $('#aimSlider').value = Math.round(aimHeading);
      const h = Math.round(aimHeading);
      if (h !== aimSent) { aimSent = h; active.robot.drive(0, h).catch(() => {}); }
      return;
    }

    if (v) {
      const mag = Math.min(1, Math.hypot(v.x, v.y));
      lastHeading = (Math.round(Math.atan2(v.x, v.y) * 180 / Math.PI) + 360) % 360;
      const speed = v.turbo ? 255 : Math.round(mag * maxSpeed);
      active.robot.drive(speed, lastHeading).catch(() => {});
      moving = true;
    } else if (moving) {
      moving = false;
      active.robot.drive(0, lastHeading).catch(() => {});
    }
  }
  setInterval(tick, 50);

  // ---------------------------------------------------------------- aim mode
  $('#aimBtn').addEventListener('click', () => {
    if (!active || active.status !== 'ok') { toast('Connect a Sphero first.'); return; }
    aimMode = !aimMode;
    $('#aimBox').classList.toggle('on', aimMode);
    $('#aimBtn').textContent = aimMode ? '✖ Cancel aiming' : '🎯 Set which way is forward';
    if (aimMode) {
      aimHeading = lastHeading; aimSent = null;
      active.robot.setBackLed(255).catch(() => {});
    } else {
      active.robot.setBackLed(0).catch(() => {});
    }
  });
  $('#aimSlider').addEventListener('input', (e) => { aimHeading = +e.target.value; });
  $('#aimDone').addEventListener('click', async () => {
    if (!active) return;
    aimMode = false;
    $('#aimBox').classList.remove('on');
    $('#aimBtn').textContent = '🎯 Set which way is forward';
    try {
      await active.robot.resetYaw();
      await active.robot.setBackLed(0);
      lastHeading = 0;
      toast('Forward is set!', 'ok');
    } catch (e) { toast('Could not set aim: ' + e.message, 'bad'); }
  });

  // ---------------------------------------------------------------- misc wiring
  $('#speed').addEventListener('input', (e) => { maxSpeed = +e.target.value; $('#speedOut').textContent = maxSpeed; });
  $('#connectBtn').addEventListener('click', connectNew);
  window.addEventListener('gamepadconnected', (e) => toast(`Game controller connected: ${e.gamepad.id.split('(')[0].trim()}`, 'ok'));

  if (!SpheroMini.supported) {
    $('#unsupported').style.display = 'block';
    $('#connectBtn').disabled = true;
    if (!window.isSecureContext) $('#unsupported').innerHTML = '<b>This page must be opened over <code>https://</code> (or from <code>localhost</code>) for Bluetooth to work.</b>';
  }
  renderAll();
})();
