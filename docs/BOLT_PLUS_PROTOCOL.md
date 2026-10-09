# Sphero BOLT+ Bluetooth notes

Everything we know about controlling a Sphero BOLT+ over Web Bluetooth, and how we know it. Sphero publishes no
protocol documentation for the BOLT+, so every fact below carries one of these labels:

- **Tested**: we sent it to a real BOLT+ and checked the result (the ball's reply, its sensor stream, or a person watching).
- **Recorded**: captured from the official Sphero Edu web app (edu.sphero.com) while a known function ran.
- **Probed**: we only know the command exists, or how long its payload is.

Sources: balls BP-6226, BP-7314 and BP-8145 (manufactured 2025-03-21, firmware 2.24.1610, which is the current BOLT+
firmware in Sphero Edu as of 2026-10-09), Chrome on macOS, 2026-10-09. Command **names** come from the command table
inside the Sphero Edu web app; the full 220-command list is in [`SPHERO_COMMAND_TABLE.md`](SPHERO_COMMAND_TABLE.md).
Function names and "compatible robots" come from Sphero Edu's API definitions.

Contents: [Quick reference](#quick-reference) · [Connecting](#connecting) · [Packets](#packet-format) ·
[Lights](#lights) · [Screen](#screen) · [8×8 drawing](#8x8-drawing-and-animations) · [Driving](#driving) ·
[Sensors](#sensors) · [Infrared](#infrared) · [Power and system](#power-and-system-info) ·
[How Sphero Edu uses all this](#how-sphero-edu-uses-these-commands) · [Driving measurements](#driving-measurements) ·
[Inside the robot](#inside-the-robot) · [Warnings](#warnings) · [Open questions](#open-questions)

## Quick reference

What our site (`bolt.html` + `sphero.js`) sends to a BOLT+. All Tested.

| When | Commands |
| --- | --- |
| Connect | wake `13 0D`; stop + stabilization on `16 51 01` |
| Show the ball's color | all six LEDs `1A 1A 00 03 FF FF` + 18 values; screen `15 02 r g b` |
| Drive | `16 07 speed headingHi headingLo 00`, resent while a key is held |
| Aim start | all LEDs off except back blue; aim picture `15 10 00 00 00 02 01`; `16 07 00 …` to rotate |
| Aim done | reset aim `16 06`; color back on LEDs and screen |
| Battery | `13 10` → percent (every 30 s) |

## Connecting

| Fact | Status |
| --- | --- |
| Advertised name `BP-xxxx`. The ball's screen shows the same code when awake. | Tested |
| Wakes when lifted off or placed on the charger. No power button. | Sourcewell BOLT+ guide, Tested |
| Cannot connect while sitting on the charger (so it cannot be updated there). Firmware updates take 1–5 minutes. | Sphero support site |
| Service `00010001-574f-4f20-5370-6865726f2121` | Tested |
| Characteristic `00010002-…` = command channel (write, write-without-response, notify) | Tested |
| Characteristic `00010003-…` = text debug console (see [Inside the robot](#debug-console)) | Tested |
| **No unlock step.** The Mini/BOLT "usetheforce...band" service `00020001-…` does not exist on the BOLT+. | Tested |
| Writes longer than **20 bytes are silently dropped**. Split packets into 20-byte pieces; the framing allows it. | Tested |
| A ball talks to one computer at a time. A ball held by another tab or computer does not appear in the picker. | Tested |
| Sphero Edu also requests the older Sphero service `22bb746f-2ba0-7554-2d6f-726568705327`. Not needed. | Recorded |

## Packet format

Same "API v2" format as the Mini and the original BOLT:

```
8D  FLAGS  [TID]  [SID]  DID  CID  SEQ  [ERR]  DATA…  CHK  D8
```

- `CHK` = `~(sum of the bytes between 8D and CHK) & 0xFF`.
- Inside a packet, `8D`, `D8`, `AB` are escaped as `AB 05`, `AB 50`, `AB 23`.
- FLAGS bits: `01` response, `02` requests a response, `08` resets the sleep timer, `10` has TID, `20` has SID.
- Sphero Edu sends FLAGS `3A` with TID `11`, SID `01` (wake uses `0A` without IDs). **Sending without TID/SID works for
  every command in these notes** (Tested); replies then carry only a SID.
- Notifications from the ball have bit `01` clear and SEQ `FF`.
- Error codes (names from Sphero's public RVR SDK): `00` success, `01` bad device id, `02` bad command id,
  `03` not yet implemented, `04` **restricted**, `05` bad data length, `06` failed, `07` bad data value, `08` busy,
  `09` bad target id, `0A` target unavailable. The BOLT+ has one processor: target `12` answers `09` to everything.
- Flag `04` (per the RVR SDK) asks for a response only on error, and `80` means an extra flags byte follows.

## Lights

Six RGB LEDs = 18 channels. `1A 1A` (Set All Leds With 32 Bit Mask): 4-byte big-endian mask, then one value per set
bit, lowest bit first. Recorded from each Sphero Edu function, Tested.

| LED | Mask bits | Mask | Edu function |
| --- | --- | --- | --- |
| Left, part 1 | 0–2 | `0x00000007` | `setLeftLed` |
| Back | 3–5 | `0x00000038` | `setBackLed` (a single number sets blue only) |
| Right, both parts | 6–11 | `0x00000FC0` | `setRightLed` |
| Front | 12–14 | `0x00007000` | `setFrontLed` |
| Left, part 2 | 15–17 | `0x00038000` | `setLeftLed` |
| All six | 0–17 | `0x0003FFFF` | `setMainLed` |

## Screen

The screen is 128×128. Full-resolution graphics are limited to Sphero's built-in pictures and animations stored on the
ball, text, a solid color, and live sensor readouts. Custom drawing is 8×8 only ([next section](#8x8-drawing-and-animations)).

| Command | Payload | Meaning | Edu function | Status |
| --- | --- | --- | --- | --- |
| `15 01` | — | Get Display Mode: 0 idle, 1 text, 2 color, 3 matrix, 4 animation, 5 sensor | — | Tested |
| `15 02` | r g b | fill the screen with a color (color mode) | `setDisplayColor` | Tested |
| `15 03` | text, `00`, text r g b, background r g b, font, `00` | show text | `setDisplayText` | Recorded |
| `15 07` | — | clear the screen (idle mode) | `clearDisplay` | Recorded |
| `15 0B` | n | rotate n quarter turns | `setDisplayRotation` | Recorded |
| `15 10` | id (uint32), loop | show a built-in picture or animation | `setDisplayImage`, `setDisplayAnimation` | Tested |
| `15 14` | mask (uint32) | live sensor readout: 1 orientation, 2 accel, 4 total accel, 8 location, 16 velocity, 32 speed, 64 gyro, 128 light | `setLiveSensorData` | Recorded |
| `15 11` | — | Get Animation Complete Status | — | Recorded |
| `15 12` | 0/1 | Enable Animation Complete notifications (Edu: on at program start, off at end) | — | Recorded |

Built-in ids seen: `0x0A` default face (Edu restores it, looping), `0x02` aim screen, `0x08`, `0x0267` "apple",
`0x0425`, `0x0429`, `0x042D` "applause". Sphero Edu says there are 650+.

**Changing the picture in Sphero Edu only picks a built-in id.** While the teacher changed pictures in Edu, every
change was a `15 10` and the largest message was 22 bytes. Nothing uploads picture data (see
[Inside the robot](#hidden-command-groups) for where an upload channel might be).

## 8×8 drawing and animations

Imitates the original BOLT's 8×8 LED grid on the BOLT+ screen; each pixel shows as a big square. Tested with the
teacher watching on BP-7314.

**The screen must be in matrix mode** or nothing shows. Drawing one pixel with `1A 2D` switches to matrix mode;
`1A 2E` alone does not. Sphero Edu fills the matrix black (`1A 2F 00 00 00`) at program start, which does the same.

| Command | Payload | Edu function / result | Status |
| --- | --- | --- | --- |
| `1A 2F` | r g b | fill the whole matrix | Recorded |
| `1A 2D` | x y r g b | `drawMatrixPixel` | Tested |
| `1A 3D` | x1 y1 x2 y2 r g b | `drawMatrixLine` | Recorded |
| `1A 3E` | x1 y1 x2 y2 r g b | `drawMatrixFill` | Recorded |
| `1A 42` | r g b char | `setMatrixCharacter` | Recorded |
| `1A 3B` | r g b speed loop text `00` | `scrollMatrixText` | Recorded |
| `1A 3A` | n | `setMatrixRotation` (quarter turns) | Recorded |
| `1A 2E` | 64 × (r g b) = 192 bytes, row by row from pixel (row 0, col 0) | whole picture at once; pixel 0 is a screen corner | Tested |
| `1A 35` | — | delete all saved animations and frames | Tested |
| `1A 30` | frame index (uint16), 4 bit-planes × 8 bytes | save one frame of palette indices 0–15 | Tested |
| `1A 31` | index, fps, fade 0/1, palette count, palette (r g b each), frame count (uint16), frame indices (uint16 each) | save an animation | Tested |
| `1A 43` | index, loop 0/1 | play; the ball sends `1A 3F` when it stops | Tested |
| `1A 38` | — | reset (stop) animation; also `clearMatrix` | Tested |
| `1A 39` | fps, transition | `overrideMatrixAnimationFramerate` (`00 00` resets) | Recorded |
| `1A 36` / `1A 37` | — | pause / resume | Recorded |

**Frame packing for `1A 30`:** visit pixels column by column (col 0→7), and within each column from row 7 up to row 0;
the n-th pixel visited is bit n. Each palette index adds one bit to each of four 64-bit planes, **bit-0 plane first**,
each plane big-endian with the upper 32 bits first. Packing one 4-bit index per pixel instead shows a blank screen with
a couple of blinking red dots.

Sphero Edu's own code saves animations with `1A 40` (assign frames) and `1A 41` (save without frames), but it skips a
zero animation index or a false fade flag, so we use `1A 31` with every field present.

## Driving

| Command | Payload | Meaning | Edu function | Status |
| --- | --- | --- | --- | --- |
| `16 07` | speed, heading (uint16), flags | roll at speed toward heading (0 = aim direction, clockwise) | `setHeading`, `setSpeed`, `stopRoll`, Drive mode | Tested |
| `16 06` | — | reset aim: the current facing becomes heading 0 | `resetAim`, Aim done | Tested |
| `16 51` | 0/1 | Stop With Default Deceleration And Stabilization: stops, then stabilization off/on | `setStabilization` | Tested |
| `16 4C` | yaw (int16), speed, seconds (float32) | Drive Time At Yaw; ball sends `16 4D` when done | `roll(h, s, t)` | Recorded |
| `16 49` | yaw (int16), speed, meters (float32) | Drive Distance At Yaw; ball sends `16 4E` when done | `rollToDistance` | Recorded |
| `16 44` | — | Get Active Control System Id (15 = temporospatial vector drive during timed/distance rolls; 17 when idle, beyond Sphero's list) | — | Tested |
| `16 01` | modeL, powerL, modeR, powerR | raw motors (mode 1 forward, 2 reverse); Edu turns stabilization off first | `rawMotor` | Recorded |
| `16 35` | turn (int8), speed (int8), flags | Drive Rc Normalized: turn rate + speed; spins in place fast | — | Tested |
| `16 33` | left (int8), right (int8) | Drive Tank Normalized | — | Probed |
| `16 21` | component, group | Get Component Parameters (controller tunings, see [Inside the robot](#control-settings)) | — | Tested |
| `16 3F` | (notification) | Robot Has Stopped | — | Recorded |

- `16 07` flag `0x04` ("fast turn" in the spherov2 library) made no visible difference.
- `spin(360, 1)` sends no special command: Edu steps `16 07` headings about 8 times a second.
- Speed bytes differ between Edu functions (Edu speed 40 became `0x1A` in `16 4C` but `0x34` from `setSpeed`; Drive
  mode at full speed sends `0xA6` = 166). Our site treats the byte as raw 0–255.
- **Sphero Edu sends `16 51 00` (stabilization off) whenever a program ends**, leaving the ball limp until something
  turns it back on. Our site sends `16 51 01` on connect.
- No compass: Edu marks `calibrateCompass` / `setCompassDirection` / `getCompassDirection` as original-BOLT only, and
  the BOLT's `18 25` answers "unknown command". Forward must be set with Aim.

## Sensors

Streaming, as Sphero Edu configures it while a program runs:

```
18 00   interval (uint16 ms)  count (1)  mask (uint32)     Edu: 00 96 | 00 | 00 07 E0 78   (150 ms)
18 0C   extended mask (uint32)                             Edu: 03 84 00 00
```

The ball then sends `18 02` notifications holding 14 big-endian float32 values (Tested):

| # | Value | Units |
| --- | --- | --- |
| 0–2 | pitch, roll, yaw | degrees (yaw is counter-clockwise positive: heading 90 reads about −90) |
| 3–5 | acceleration x, y, z | g (z ≈ 1 at rest) |
| 6–7 | location x, y | meters from program start |
| 8–9 | velocity x, y | meters per second |
| 10–12 | gyroscope x, y, z | degrees per second |
| 13 | ambient light | lux |

| Command | Payload | Meaning | Status |
| --- | --- | --- | --- |
| `18 30` | — | ambient light, float32 lux | Tested |
| `18 13` | — | reset location to 0,0 | Recorded |
| `18 47` | `00 01 00 FA` | Configure Sensitivity Based Collision Detection: accelerometer method, "very high" sensitivity, 250 ms dead time | Recorded |
| `18 48` | 01 | collision notifications on; the ball sends `18 49` on a bump | Recorded |
| `18 0F` | 01 | "gyro max" notifications on | Recorded |
| `18 5A` | `4B 82` | Configure Collision Threshold; Edu sends it at connect and the ball rejects it (`07`) | Recorded |
| `18 22` | — | Get Bot To Bot Infrared Readings (BP-7314: `04 04 04 04`) | Tested |

Registering events in Sphero Edu (`onCollision`, `onFreefall`, `onCharging`, …) sends nothing: the app works them out
from the stream and from the notifications it enables at connect.

## Infrared

All Recorded with a single ball, so the behavior itself (following, evading, messages) was not observed.

| Command | Payload | Edu function |
| --- | --- | --- |
| `18 27` / `18 29` | far near / — | `startIRBroadcast(near, far)` / `stopIRBroadcast` |
| `18 28` / `18 32` | far near / — | `startIRFollow` / `stopIRFollow` |
| `18 33` / `18 34` | far near / — | `startIREvade` / `stopIREvade` |
| `18 3F` | channel, 4 × intensity | `sendIRMessage(channel, intensity)` |
| `18 3E` | 0/1 | IR message notifications (`listenForIRMessage`) |

## Power and system info

| Command | Meaning | Example reply | Status |
| --- | --- | --- | --- |
| `13 0D` | wake | — | Tested |
| `13 10` | battery percent | `32` = 50% | Tested (Edu polls every 10 s) |
| `13 03` | battery voltage (Mini) | `02` not supported on BOLT+ | Tested |
| `13 17` / `13 1F` | battery voltage state / charger state | `01` / `01` | Recorded |
| `13 1B 01` / `13 20 01` | battery-state / charger notifications on | — | Recorded |
| `13 26` | battery voltage thresholds | 3.55 V, 3.65 V, 0.005 | Tested |
| `11 00` / `11 01` | main app / bootloader version | 2.24.1610 / 2.3.418 | Tested |
| `11 03` | board revision | 2 | Tested |
| `11 1F` | processor name | "Nordic" | Tested |
| `11 20` | boot reason | 0 = cold boot | Tested |
| `11 33` | manufacturing date | 2025-03-21 | Tested |
| `11 38` | SKU | "0600" | Tested |
| `11 39` | uptime | milliseconds | Tested |
| `11 47` | unique id | 6 bytes | Tested |
| `19 05` | Bluetooth advertising name | "BP-7314" | Tested |
| `1D 15` | current application: `01` main app, `00` bootloader | — | Tested |
| `10 05` / `10 06` | list supported device groups / commands in a group | — | Tested |

Answered "not supported": MAC address, model number, last error info, three-character SKU, SOS message, battery
voltage, battery state, motor fault state, drive target slew parameters, RGBC color sensor, detected color, motor
thermal protection status, active color palette.

## How Sphero Edu uses these commands

- **Connect:** `1D 15`, wake, versions and ids (`11 38`, `11 00` ×2, `11 13`, `11 47`, `11 03`, `11 33`), battery and
  charger notifications on, all LEDs white, clear screen, default face, collision setup (`18 47`, `18 5A`, `18 48`,
  `18 0F`), streaming off, charger state; then battery percent every 10 s. It also checks firmware and updates it if
  needed.
- **Program start:** LEDs off, matrix black, stop, reset location, reset aim, stabilization on, clear screen,
  `15 12 01`, streaming on.
- **Program end:** streaming off, stop, infrared off, **stabilization off**, clear matrix, rotation 0, matrix fps reset,
  clear screen, default face, LEDs white, `15 12 00`.
- **Aim:** LEDs off except back blue, matrix black, aim picture, `16 07` speed 0 while rotating; Done: reset aim, default
  face, LEDs white. Quick taps on the aim buttons send no turn at all.
- **Drive mode:** `16 51 01`, `16 06`, screen light blue (`15 02 83 AE E6`), then `16 07` about every 500 ms
  (full speed `A6`).
- **Picture picker:** `15 10` with a built-in id.

## Driving measurements

All from the ball's own sensor stream on carpet (BP-7314).

**Turning in place** with `16 07`: the ball reaches the new heading in under 0.5 s.

**Traction.** One-second drives at raw speed 70:

| Drive | No covering | Covering on |
| --- | --- | --- |
| forward / backward / right / left / diagonal | 7 / 13 / 3 / 21 / 15 cm | 25 / 13 / 9 / 18 / 19 cm |
| total | 59 cm | 84 cm |

**Speed, covering on:**

| Test | Distance | Peak speed | Max drive tilt | Teacher's rating |
| --- | --- | --- | --- | --- |
| 150 | — | — | — | too slow |
| 200 forward, 1.1 s | 115 cm | 123 cm/s | 77° | about right |
| 255 backward, 1.1 s (includes turning around) | 46 cm | 70 cm/s | 80° | about right |
| 200, turn 90° while rolling | path turned 70° after 0.63 s | 118 cm/s | 110° | a wide curve |

High drive tilt with little movement means the drive is climbing the inside of the shell instead of rolling it.
The BOLT+ page defaults to speed 200.

## Inside the robot

### Control settings

`16 21` (Get Component Parameters, payload component and group) answered for 14 combinations on BP-8145; every other
combination of 0–20 × 0–10 answered `06`. Values are float32. Six-value sets look like controller tunings (three gains,
a decay factor, output limits). **What each component controls is unknown**, and nothing has been changed.

| Component | Group | Values |
| --- | --- | --- |
| 2 | 0, 1 | 2, 0.12, 0, 0.8, 1, −1 |
| 4 | 0 | 1, 1, 0, 0.8, 1, −1 |
| 4 | 1 | 80 |
| 18 | 0 | 51, 0.1, −0.012, 0.9, 1, −1 |
| 18 | 1 | 2 |
| 18 | 2 | 15, 0.2, −0.01, 0.9, 1, −1 |
| 18 | 3 | 3 |
| 18 | 4 | 0.6 |
| 19 | 0 | −15, 0.3, −0.01, 1, 0.2, −0.2 |
| 19 | 1 | 50, 0, −0.015, 0.9, 0.02, −0.02 |
| 19 | 2 | −15, 0, −0.01, 0.5, 0.05, −0.05 |
| 19 | 3 | 3, −1 |
| 19 | 4 | 10 |

### Debug console

Characteristic `00010003-…` takes text lines ending in a newline and answers in text ending with `>>>`. `list` prints
its 167 commands (`list <word>` filters); `help` prints a joke from Colossal Cave Adventure. Informational commands and
their answers:

| Command | Answer |
| --- | --- |
| `ver` | board rev 2, bootloader 2.3.418, main app 2.24.1610, bios 1.0.58, net core 2.1.103 |
| `build` | repo boltplus-nrf53-mainapp, branch develop, CI build 2025-01-15 |
| `info` | processor Nordic, stats id 27, SKU 0600, manufactured 2025-03-21 |
| `battery` | volts, percent, ADC, state (gives volts, which `13 03` does not) |
| `temp` | two temperatures (about 30 °C fresh, 40 °C after heavy use) |
| `charger` | NOT_CHARGING / charging state |
| `bmivariant` / `alsvariant` / `alslux` | Bosch BMI055 motion sensor, Vishay VEML6030 light sensor, lux |
| `displaymode`, `rotation`, `livesensormask`, `matrixcolors`, `getmonitorstatus` | screen state; matrix colors are 16-bit RGB565 |
| `protectedregions` | internal flash: bootloader `0x00000000–0x0002FFFF`, main app `0x00030000–0x000FBFFF` |
| `cbinfo`, `loginfo`, `systime`, `playmode`, `mode`, `swdstatus`, `netver`, `bootreason` | config block, event log usage, timing stats, play mode 1, user mode, debug port locked, cold boot |

The console's screen commands cover mode, color, text, animation id, live sensor, rotation, clear, 8×8 drawing and
test patterns. None uploads pictures.

### Hidden command groups

The ball lists three device groups that are not in Sphero Edu's command table. Each command was sent once with no
payload on spare ball BP-8145:

| Group | Commands | Result |
| --- | --- | --- |
| `1B` | `1C 1E 20` | all answer `04` "wrong mode": locked outside the normal user mode |
| `21` | `19 1A 1B 1D 1E 20 21 22 23 24 25 26 27` | all answer `04` "wrong mode" |
| `23` | `00 03 04 05 07 08 09 0B 0C 0D` | **firmware update (OTA)**. `03` version; `0C` image slot info; `04` → 486, the update chunk size; `07`, `0B` → `01`; `0D` → `00`; `00` → empty OK; `08`, `09` need data; `05` → failed (nothing staged) |

Groups `1B` and `21` answer `04`, which Sphero's RVR SDK calls **restricted**: gated, not missing.

Drive group `16` also supports `0E 0F 20 22 32 34 36 37 41 42 43 45 46 4A 4B 4F 50`, several of which are not in Sphero
Edu's table. Sphero's public RVR SDK uses the same numbers for: `0E` set default control system for type, `22` set
custom control system timeout, `32` drive tank SI, `34` drive RC SI, `36` drive with yaw SI, `37` drive with yaw
normalized, `41` get stop controller state, `42` drive stop, `43` restore default control system timeout,
`45` restore initial default control systems, `46` get default control system for type. These names are from the RVR
and are not confirmed on the BOLT+. The RVR's slew-rate commands (`3C`–`3E`, `40`) are not supported by the BOLT+.

**Firmware.** Sphero Edu's update package (`boltplus-2.24.1610.zip`) has a manifest with the version, the 486-byte
chunk size, 1024 chunks, the image size (497,400 bytes) and a 20-byte digest. The firmware image itself is
**encrypted**, and the debug port is locked, so custom firmware would need Sphero's keys or opening the ball and
erasing the chip. The 497 KB image is far too small for the 650+ built-in pictures, so those live in separate storage.
If a picture-upload channel exists, it is most likely in the mode-locked groups `1B` or `21`.

## Warnings

- **Never send group `23` commands to a ball you need.** After the probe above, BP-8145 later restarted into its
  bootloader (`1D 15` answered `00`, wake answered "not supported"). It recovered on its own after a trip to the
  charger. If a ball stays in bootloader mode, connecting it with Sphero Edu should reinstall the firmware.
- **Avoid `16 0F`.** It runs with any payload; the spherov2 library calls it "pitch torque modification".
- **Don't use the console's numbered `cp` command.** BP-8145 disconnected right after `cp 2 0` and was found freshly
  restarted; whether `cp` caused it is unconfirmed.
- Console commands not to run casually: `hardfault`, `while1`, `stackof` (deliberate crashes), `logerase`, `factory`,
  `rst`, `zz`/`zq` (sleep), `battcal`, `enccal`/`clearenccal` (calibration), `shakeconfig*`, `motor`, and the drive
  commands `roll`, `rl`, `tank`, `rc` (they move the ball).
- Leaving a ball connected in one tab hides it from every other computer.

## Open questions

- Receiving an infrared message (needs two balls), `registerSoftwareButton`, `speak` (likely runs on the device only).
- What control-setting components 2, 4, 18 and 19 are.
- What the mode-locked groups `1B` and `21` do, and whether one of them uploads pictures.
