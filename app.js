/* Sphero Drive — UI + input handling. Talks to robots through sphero.js (window.SpheroMini). */
(function () {
  'use strict';

  const $ = (sel) => document.querySelector(sel);

  // Shown next to the title so the teacher can tell at a glance whether a student has reloaded.
  // Bump on every deploy: +0.01 for small fixes, a bigger step for new features.
  const VERSION = '1.07';
  if ($('#version')) $('#version').textContent = 'v' + VERSION;
  console.info('Sphero Drive v' + VERSION);

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

  // Two key sets so two students can share one keyboard. Controller 1 follows WASD, controller 2 follows Arrows.
  const KEYSETS = {
    wasd:   { label: 'WASD',   badge: 'WASD keys',  up: 'KeyW',    down: 'KeyS',      left: 'KeyA',      right: 'KeyD',       turbo: 'ShiftLeft',  pad: 0 },
    arrows: { label: 'Arrows', badge: 'Arrow keys', up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', turbo: 'ShiftRight', pad: 1 },
  };
  const KEYSET_ORDER = ['wasd', 'arrows'];

  // robots: { robot, id, nick, customNick, color, colorName, status, battery, keys, heading, moving, el }
  const robots = [];
  let active = null;        // the selected card: joystick, color, aim and the B key apply to it
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
    const ok = robots.filter((r) => r.status === 'ok');
    const lost = robots.filter((r) => r.status === 'bad');
    const connecting = robots.filter((r) => r.status === 'connecting');
    const keysFor = (r) => (r.keys ? KEYSETS[r.keys].label : 'joystick');
    banner.className = '';
    if (!robots.length) {
      text.textContent = 'No Sphero connected';
    } else if (connecting.length) {
      banner.classList.add('warn');
      text.textContent = `Connecting to ${connecting.map((r) => r.nick).join(' and ')}…`;
    } else if (lost.length) {
      if (ok.length) banner.classList.add('warn');
      text.textContent = `${lost.map((r) => r.nick).join(' and ')} lost connection. Shake it, then click Reconnect.`;
    } else if (ok.length === 1) {
      banner.classList.add('ok');
      text.textContent = `Connected: ${ok[0].nick}`;
    } else {
      banner.classList.add('ok');
      text.textContent = 'Connected: ' + ok.map((r) => `${r.nick} (${keysFor(r)})`).join(' · ');
    }
    $('#driveWho').textContent = active ? `for ${active.nick}` : '';
    const canDrive = active && active.status === 'ok';
    $('#stickOverlay').hidden = !!canDrive;
    $('#stick').classList.toggle('dead', !canDrive);
    if (!canDrive) $('#stickOverlay').textContent = robots.length ? 'Click a connected Sphero' : 'Connect a Sphero first';
  }

  // ---------------------------------------------------------------- robot cards
  function renderCard(entry) {
    if (!entry.el) {
      const el = document.createElement('div');
      el.className = 'robot';
      el.innerHTML = `
        <span class="drivetag">Selected</span>
        <div class="top">
          <span class="swatch"></span>
          <span class="name"></span>
          <button class="rename" data-act="rename" title="Rename">✏️</button>
        </div>
        <span class="keys"></span>
        <div class="status"><span class="dot"></span><span class="statusText"></span></div>
        <div class="meta"><span class="id"></span> · <span class="batt">🔋 —</span></div>
        <div class="actions">
          <button data-act="blink">✨ Blink</button>
          <button data-act="reconnect" class="primary">🔄 Reconnect</button>
          <button data-act="sleep">💤 Sleep</button>
          <button data-act="disconnect" class="danger">✕ Remove</button>
        </div>`;
      el.addEventListener('click', (e) => {
        // Clicking anywhere on a card picks it, except Remove and the rename box.
        if (e.target.closest('[data-act=disconnect], input')) return;
        setActive(entry);
      });
      el.querySelector('[data-act=rename]').addEventListener('click', () => editNick(entry));
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
    const kb = el.querySelector('.keys');
    kb.textContent = entry.keys ? KEYSETS[entry.keys].badge : 'No keys (joystick only)';
    kb.dataset.set = entry.keys || 'none';
    const st = el.querySelector('.status');
    st.className = 'status ' + ({ ok: 'ok', connecting: 'busy', bad: 'bad' }[entry.status]);
    el.querySelector('.statusText').textContent = { ok: 'Connected', connecting: 'Connecting…', bad: 'Disconnected' }[entry.status];
    el.querySelector('.batt').textContent = entry.battery == null ? '🔋 —' : `🔋 ${entry.battery.pct}% (${entry.battery.volts.toFixed(2)} V)`;
    el.querySelector('[data-act=reconnect]').style.display = entry.status === 'bad' ? '' : 'none';
    el.querySelector('[data-act=blink]').disabled = entry.status !== 'ok';
    el.querySelector('[data-act=sleep]').disabled = entry.status !== 'ok';
    $('#noRobots').style.display = robots.length ? 'none' : '';
  }
  function renderAll() {
    robots.forEach(renderCard);
    updateBanner();
    updateSwatches();
    $('#swapKeys').hidden = !(keysOwner('wasd') && keysOwner('arrows'));
  }

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
    if (aimTarget && aimTarget !== entry) endAim(false);
    active = entry;
    renderAll();
  }

  // ---------------------------------------------------------------- key sets
  const keysOwner = (set) => robots.find((r) => r.keys === set);
  const freeKeySet = () => KEYSET_ORDER.find((k) => !keysOwner(k)) || null;

  // One deliberate button (under More controls) swaps WASD and Arrows between the two Spheros.
  function swapKeys() {
    const a = keysOwner('wasd'), b = keysOwner('arrows');
    if (!a || !b) return;
    stopRobot(a); stopRobot(b);
    a.keys = 'arrows'; b.keys = 'wasd';
    renderAll();
    toast(`Swapped! ${b.nick} uses WASD, ${a.nick} uses Arrows.`, 'ok');
  }
  $('#swapKeys').addEventListener('click', swapKeys);

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
      console.error('requestDevice failed:', err.name, err.message);
      const msg = String(err.message || '');
      if (err.name === 'NotFoundError' && /cancel/i.test(msg)) return; // student closed the chooser
      if (/adapter|not available|powered/i.test(msg)) {
        setBluetoothMissing(true);
      } else if (/disabled|policy|permission|SecurityError/i.test(msg + err.name)) {
        showProblem('Bluetooth is blocked on this computer. Ask your teacher.',
          'For IT: allow Web Bluetooth for this site (Chrome policies DefaultWebBluetoothGuardSetting / WebBluetoothAskForUrls).');
      } else {
        showProblem('Bluetooth didn\'t open. Ask your teacher.', `${err.name}: ${msg || 'unknown error'}`);
      }
      return;
    }
    let entry = robots.find((r) => r.id === robot.device.id);
    if (entry) {
      toast(`Reconnecting ${entry.nick}…`);
      return reconnect(entry);
    }
    const c = pickColor();
    const saved = loadNick(robot.device.id);
    entry = { robot, id: robot.device.id, nick: saved || c.name, customNick: !!saved, color: c.hex, colorName: c.name,
      status: 'connecting', battery: null, keys: freeKeySet(), heading: 0, moving: false, el: null };
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
      toast(`${entry.nick} connected! Look for the ${entry.colorName.toLowerCase()} light.`, 'ok');
      blink(entry);
      refreshBattery(entry);
      if (!active || active.status !== 'ok') setActive(entry);
    } catch (err) {
      console.error(err);
      entry.status = 'bad';
      renderAll();
      toast(`Couldn't connect. Shake ${entry.nick}, then click Reconnect.`, 'bad', 6000);
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
      toast(`${entry.nick} lost connection. Shake it, then click Reconnect.`, 'bad', 7000);
    }
  }

  async function removeRobot(entry) {
    entry.status = 'removed';
    try { await entry.robot.disconnect(); } catch {}
    if (aimTarget === entry) endAim(false);
    robots.splice(robots.indexOf(entry), 1);
    entry.el.remove();
    if (entry.keys) { const heir = robots.find((r) => !r.keys); if (heir) heir.keys = entry.keys; }
    if (active === entry) active = robots.find((r) => r.status === 'ok') || robots[0] || null;
    renderAll();
  }

  async function sleepRobot(entry) {
    try { await entry.robot.sleep(); toast(`${entry.nick} is asleep. Shake it to wake it.`); } catch (e) { toast(e.message, 'bad'); }
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

  function applyColor(hex, target = active) {
    if (!target || target.status !== 'ok') { toast('Connect a Sphero first.'); return; }
    target.color = hex;
    const name = paletteName(hex);
    target.colorName = name || 'Custom';
    if (!target.customNick) target.nick = name || 'Custom';
    const [r, g, b] = hexToRgb(hex);
    target.robot.setColor(r, g, b).catch(() => {});
    renderAll();
  }

  function cycleColor(dir, target = active) {
    if (!target) return;
    const i = PALETTE.findIndex((p) => p.hex.toLowerCase() === target.color.toLowerCase());
    const next = PALETTE[((i < 0 ? 0 : i + dir) + PALETTE.length) % PALETTE.length];
    applyColor(next.hex, target);
  }

  $('#colorPick').addEventListener('input', (e) => applyColor(e.target.value));

  // ---------------------------------------------------------------- inputs
  // Keys are tracked by physical position (e.code) so Left and Right Shift can be told apart.
  const DRIVE_CODES = new Set(Object.values(KEYSETS).flatMap((k) => [k.up, k.down, k.left, k.right, k.turbo]));
  const keys = new Set();

  // Only a box you can type into (renaming a Sphero) should swallow the driving keys. Sliders, the color
  // picker and buttons keep focus after a click, and they must not stop the keyboard from driving.
  const NON_TEXT_INPUTS = new Set(['range', 'color', 'checkbox', 'radio', 'button', 'submit', 'reset']);
  function isTypingIn(t) {
    if (!t || !t.matches) return false;
    if (t.isContentEditable || t.matches('textarea, select')) return true;
    return t.matches('input') && !NON_TEXT_INPUTS.has(t.type);
  }

  window.addEventListener('keydown', (e) => {
    if (isTypingIn(e.target)) return;
    const c = e.code;
    const digit = /^(Digit|Numpad)([1-9])$/.exec(c);
    if (digit) { const r = robots[+digit[2] - 1]; if (r) setActive(r); return; }
    if (c === 'KeyB') { if (active) blink(active); return; }
    // Space is the emergency stop: forget held keys so nobody starts again until they press a key fresh.
    if (c === 'Space') { e.preventDefault(); keys.clear(); stopAll(); return; }
    if (DRIVE_CODES.has(c)) { e.preventDefault(); if (!e.repeat || keys.has(c)) keys.add(c); }
  });
  window.addEventListener('keyup', (e) => {
    keys.delete(e.code);
    // A focused button "clicks" when Space is released; Space is the stop key, so cancel that.
    if (e.code === 'Space' && !isTypingIn(e.target)) e.preventDefault();
  });
  window.addEventListener('blur', () => { keys.clear(); stopAll(); });

  function keyboardVector(set) {
    const k = KEYSETS[set];
    let x = 0, y = 0;
    if (keys.has(k.up)) y += 1;
    if (keys.has(k.down)) y -= 1;
    if (keys.has(k.left)) x -= 1;
    if (keys.has(k.right)) x += 1;
    const m = Math.hypot(x, y);
    return m ? { x: x / m, y: y / m, turbo: keys.has(k.turbo) } : null;
  }

  // On-screen joystick (drives the selected Sphero)
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

  // Real gamepads: the first one plugged in follows WASD's Sphero, the second follows Arrows'.
  const padPrev = {};
  let padVectors = [null, null];
  function readGamepads() {
    const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter((p) => p && p.connected) : [];
    const chip = $('#padChip');
    chip.classList.toggle('on', pads.length > 0);
    chip.textContent = pads.length === 0 ? 'Gamepad: none'
      : pads.length === 1 ? 'Gamepad: ' + (pads[0].id.split('(')[0].trim().slice(0, 24) || 'connected')
      : `Gamepads: ${pads.length}`;
    padVectors = [null, null];
    pads.slice(0, 2).forEach((pad, slot) => {
      const target = driverFor(KEYSET_ORDER[slot]);
      const prev = padPrev[pad.index] || (padPrev[pad.index] = {});
      const pressed = (i) => !!(pad.buttons[i] && pad.buttons[i].pressed);
      const edge = (i) => { const now = pressed(i), was = !!prev[i]; prev[i] = now; return now && !was; };
      if (edge(4)) cycleColor(-1, target);
      if (edge(5)) cycleColor(1, target);
      if (edge(0) && target) blink(target);

      let x = pad.axes[0] || 0, y = -(pad.axes[1] || 0);
      if (pressed(12)) y = 1; if (pressed(13)) y = -1; if (pressed(14)) x = -1; if (pressed(15)) x = 1;
      const m = Math.hypot(x, y);
      if (m < 0.15) return;
      const scale = Math.min(1, (m - 0.15) / 0.85) / m; // dead zone, then ramp to full
      padVectors[slot] = { x: x * scale, y: y * scale, turbo: pressed(7) };
    });
  }

  // Who a key set / controller drives: the Sphero that owns it, or the selected one if nobody does.
  function driverFor(set) {
    const owner = keysOwner(set);
    return owner || active || null;
  }

  // ---------------------------------------------------------------- drive loop
  let aimTarget = null, aimHeading = 0, aimSent = null;

  function stopRobot(entry) {
    entry.moving = false;
    if (entry.status === 'ok') entry.robot.drive(0, entry.heading).catch(() => {});
  }
  function stopAll() { robots.forEach(stopRobot); }

  function inputFor(entry) {
    if (entry === active && joy) return joy;
    for (const set of KEYSET_ORDER) {
      if (driverFor(set) !== entry) continue;
      const v = padVectors[KEYSETS[set].pad] || keyboardVector(set);
      if (v) return v;
    }
    return null;
  }

  function tick() {
    readGamepads();
    showKnob(active ? inputFor(active) : null);
    for (const entry of robots) {
      if (entry.status !== 'ok') continue;
      const v = inputFor(entry);

      if (entry === aimTarget) {
        if (v) aimHeading = (aimHeading + v.x * 5 + 360) % 360;
        $('#aimSlider').value = Math.round(aimHeading);
        const h = Math.round(aimHeading);
        if (h !== aimSent) { aimSent = h; entry.robot.drive(0, h).catch(() => {}); }
        continue;
      }

      if (v) {
        const mag = Math.min(1, Math.hypot(v.x, v.y));
        entry.heading = (Math.round(Math.atan2(v.x, v.y) * 180 / Math.PI) + 360) % 360;
        const speed = v.turbo ? 255 : Math.round(mag * maxSpeed);
        entry.robot.drive(speed, entry.heading).catch(() => {});
        entry.moving = true;
      } else if (entry.moving) {
        stopRobot(entry);
      }
    }
  }
  setInterval(tick, 50);

  // ---------------------------------------------------------------- aim mode
  function endAim(save) {
    const target = aimTarget;
    aimTarget = null;
    $('#aimBox').classList.remove('on');
    $('#aimBtn').textContent = '🎯 Aim';
    if (!target || target.status !== 'ok') return Promise.resolve();
    if (!save) return target.robot.setBackLed(0).catch(() => {});
    return (async () => {
      try {
        await target.robot.resetYaw();
        await target.robot.setBackLed(0);
        target.heading = 0;
        toast('Forward is set!', 'ok');
      } catch (e) { toast('Aim didn\'t work. Try again.', 'bad'); }
    })();
  }

  $('#aimBtn').addEventListener('click', () => {
    if (aimTarget) { endAim(false); return; }
    if (!active || active.status !== 'ok') { toast('Connect a Sphero first.'); return; }
    stopRobot(active);
    aimTarget = active;
    aimHeading = active.heading; aimSent = null;
    $('#aimBox').classList.add('on');
    $('#aimBtn').textContent = '✖ Cancel';
    active.robot.setBackLed(255).catch(() => {});
  });
  $('#aimSlider').addEventListener('input', (e) => { aimHeading = +e.target.value; });
  $('#aimDone').addEventListener('click', () => endAim(true));

  // ---------------------------------------------------------------- misc wiring
  $('#speed').addEventListener('input', (e) => { maxSpeed = +e.target.value; $('#speedOut').textContent = maxSpeed; });
  $('#connectBtn').addEventListener('click', connectNew);
  window.addEventListener('gamepadconnected', () => toast('Game controller connected!', 'ok'));

  function showProblem(title, detail) {
    $('#problemTitle').textContent = title;
    $('#problemDetail').textContent = detail || '';
    $('#problemBox').hidden = false;
    toast(title, 'bad', 6000);
  }

  // ---------------------------------------------------------------- Bluetooth stick
  // Chrome on Windows often doesn't notice a USB Bluetooth stick plugged in after it started.
  // Show one big, simple fix, and keep checking so the box disappears on its own if Chrome does notice.
  const isEdge = /\bEdg\//.test(navigator.userAgent);
  const RESTART_URL = isEdge ? 'edge://restart' : 'chrome://restart';
  $('#restartCmd').textContent = RESTART_URL;
  $('#copyRestart').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(RESTART_URL); toast('Copied! Click the address bar, press Ctrl+V, then Enter.', 'ok', 6000); }
    catch { toast('Type it in the address bar instead.', 'bad'); }
  });

  let btMissing = false;
  function setBluetoothMissing(missing) {
    if (missing === btMissing) {
      if (missing) $('#btHelp').scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    btMissing = missing;
    $('#btHelp').hidden = !missing;
    if (missing) toast('Bluetooth stick not found.', 'bad', 5000);
    else toast('Bluetooth found! 🎉', 'ok');
  }

  async function pollBluetooth() {
    if (!navigator.bluetooth || !navigator.bluetooth.getAvailability) return;
    try { setBluetoothMissing(!(await navigator.bluetooth.getAvailability())); }
    catch (e) { console.warn('getAvailability failed', e); }
  }

  function checkBluetooth() {
    if (!window.isSecureContext) {
      showProblem('This page must be opened with https://', location.href);
      $('#connectBtn').disabled = true;
      return;
    }
    if (!SpheroMini.supported) {
      showProblem('Open this page in Google Chrome.', 'This browser can\'t use Bluetooth. Chrome or Edge on Windows, Mac, Chromebook or Android works.');
      $('#connectBtn').disabled = true;
      return;
    }
    pollBluetooth();
    setInterval(pollBluetooth, 3000);
    if (navigator.bluetooth.addEventListener) navigator.bluetooth.addEventListener('availabilitychanged', pollBluetooth);
  }
  checkBluetooth();
  renderAll();
})();
