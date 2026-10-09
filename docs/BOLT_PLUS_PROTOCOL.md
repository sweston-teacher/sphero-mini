# Sphero BOLT+ Bluetooth protocol notes

What we know about talking to a Sphero BOLT+ over Web Bluetooth, and how we know it.
Nothing here comes from official Sphero protocol documentation (none is published). Every entry is one of:

- **Recorded**: captured from the official Sphero Edu web app (edu.sphero.com) while a known function ran.
- **Tested**: sent by us to a real BOLT+ and the result checked (ball reply, sensor stream, or a person watching).
- **Probed**: we only know the command exists or how long its payload is.
- **Unknown**: seen, meaning not established. Do not guess.

Sources: balls BP-6226 and BP-7314 (manufacture date 2025-03-21, firmware 2.24.1610, which is the current BOLT+
firmware in Sphero Edu as of 2026-10-09), Chrome on macOS, 2026-10-09.
Function names and "compatible robots" come from Sphero Edu's API definitions file
(`core/canvas-api-definitions.ts`, loaded by the Edu code editor). **Command names** come from the command table in
Sphero Edu's `/code/sdk/toybox.js`; the full table is in `docs/SPHERO_COMMAND_TABLE.md`.

## Connecting

| Fact | Status |
| --- | --- |
| Advertised name `BP-xxxx`. The ball's screen shows the same code when awake. | Tested |
| Service `00010001-574f-4f20-5370-6865726f2121` | Tested |
| Characteristic `00010002-…` = command channel (write, write-without-response, notify) | Tested |
| Characteristic `00010003-…` = a text debug console ("That's not a command.", `>>>` prompt). Leave alone. | Tested |
| **No unlock step.** The Mini/BOLT "usetheforce...band" service `00020001-…` does not exist on the BOLT+. | Tested |
| Writes longer than **20 bytes are silently dropped**. Split packets into 20-byte pieces (the framing allows it). | Tested |
| Wakes when lifted off or placed on the charger. No power button. | Sourcewell BOLT+ guide |
| Sphero Edu also requests optional service `22bb746f-2ba0-7554-2d6f-726568705327` (older Sphero BLE service). Not needed. | Recorded |

## Packet format (same as Mini / BOLT, "API v2")

```
8D  FLAGS  [TID]  [SID]  DID  CID  SEQ  [ERR]  DATA…  CHK  D8
```

- `CHK` = `~(sum of bytes between 8D and CHK) & 0xFF`
- Inside the packet, `8D`, `D8`, `AB` are escaped as `AB 05`, `AB 50`, `AB 23`.
- FLAGS bits: `01` is a response, `02` requests a response, `08` resets the sleep timer, `10` has TID, `20` has SID.
- Sphero Edu sends FLAGS `3A` with TID `11`, SID `01` on everything except wake (`0A`, no IDs).
- **Sending without TID/SID also works** for every command below (Tested). Replies then carry only a SID.
- Async notifications from the ball have bit `01` clear and SEQ `FF`.
- Error codes: `00` ok, `01` bad device, `02` unknown command, `05` bad length, `07` bad value, `09` wrong processor.
  Target `12` (second processor) answers `09` to everything tested: the BOLT+ handles all of this on processor 1.

## Lights: 18 channels, 6 RGB LEDs (DID `1A`, CID `1A`, 32-bit mask)

Payload: `mask(4 bytes, big endian)` then one byte per set bit, lowest bit first. Recorded from each Edu function.

| LED | Mask bits | Mask | Edu function |
| --- | --- | --- | --- |
| Left (part 1) | 0–2 | `0x00000007` | `setLeftLed` |
| Back | 3–5 | `0x00000038` | `setBackLed` (a single number sets blue only) |
| Right (both parts) | 6–11 | `0x00000FC0` | `setRightLed` |
| Front | 12–14 | `0x00007000` | `setFrontLed` |
| Left (part 2) | 15–17 | `0x00038000` | `setLeftLed` |
| All six | 0–17 | `0x0003FFFF` | `setMainLed` |

Our early guess "0x07 = front" was wrong: bits 0–2 are one of the left LEDs.

## Screen (DID `15`), BOLT+ only

| Command | Payload | Meaning | Edu function | Status |
| --- | --- | --- | --- | --- |
| `15 02` | r g b | fill screen with a color | `setDisplayColor` | Recorded, Tested |
| `15 03` | text, `00`, text r g b, background r g b, font, `00` | show text | `setDisplayText` | Recorded |
| `15 07` | — | clear screen | `clearDisplay` | Recorded |
| `15 0B` | n | rotate screen n quarter turns | `setDisplayRotation` | Recorded |
| `15 10` | 4-byte id, loop | show built-in image/animation by id | `setDisplayImage`, `setDisplayAnimation` | Recorded |
| `15 14` | 4-byte mask | live sensor readout (1 = orientation, 2 accel, 4 total accel, 8 location, 16 velocity, 32 speed, 64 gyro, 128 light) | `setLiveSensorData` | Recorded |
| `15 11` | — | Get Animation Complete Status (Edu asks after a non-looping animation) | — | Recorded |
| `15 12` | 00 / 01 | Enable Animation Complete Asyncs (Edu: on at program start, off at end) | — | Recorded |

Known ids for `15 10`: `0x0000000A` = default face (Edu restores this, looping), `0x00000002` = aim screen,
`0x00000267` = "apple" image, `0x0000042D` = "applause" animation. Also seen from Sphero Edu's picture picker:
`0x00000008` (play once), `0x00000425` and `0x00000429` (looping). Drive mode first fills the screen light blue
(`15 02 83 AE E6`).

**Changing the picture in Sphero Edu only selects a built-in id.** Recorded 2026-10-09 while the teacher changed
pictures in Edu: every change was a `15 10` with an id, and the largest message in the session was 22 bytes. No
command in Edu's table uploads picture data. The firmware package (`boltplus-2.24.1610.zip`, one 497 KB program
file) is too small to contain the 650+ built-in pictures, so they are stored separately on the ball. If an upload
channel exists, it is not used by Sphero Edu; the ball's undocumented device groups `1B`, `21`, `23` are candidates
but have not been probed (risk of affecting stored pictures).

## Matrix-style drawing (DID `1A`), drawn on the BOLT+ screen

| Command | Payload | Edu function |
| --- | --- | --- |
| `1A 2F` | r g b | fill whole matrix (Edu uses black at program start) |
| `1A 2D` | x y r g b | `drawMatrixPixel` |
| `1A 3D` | x1 y1 x2 y2 r g b | `drawMatrixLine` |
| `1A 3E` | x1 y1 x2 y2 r g b | `drawMatrixFill` |
| `1A 42` | r g b char | `setMatrixCharacter` |
| `1A 3B` | r g b speed loop text `00` | `scrollMatrixText` |
| `1A 38` | — | `clearMatrix` |
| `1A 3A` | n | `setMatrixRotation` (quarter turns) |
| `1A 39` | fps transition | `overrideMatrixAnimationFramerate` (`00 00` = reset) |
| `1A 36` / `1A 37` | — | `pauseMatrixAnimation` / `resumeMatrixAnimation` |

All Recorded.

## Custom pictures and animations on the BOLT+ screen (Tested with the teacher watching, BP-7314, 2026-10-09)

The BOLT+ screen is 128×128, but **custom drawings are 8×8**: each "matrix" pixel shows as a big square. This mode
imitates the original BOLT's LED grid. Full-resolution graphics are limited to the built-in images and animations
stored on the ball (picked by id with `15 10`), text (`15 03`), a solid color (`15 02`) and live sensor data
(`15 14`). No command for uploading a custom full-resolution picture was found.

**Screen mode matters.** `15 01` (Get Display Mode) answers 0 idle, 1 text, 2 color, 3 matrix, 4 animation, 5 sensor.
Matrix drawing only shows in matrix mode. `15 02` puts the screen in color mode, `15 07` (clear) makes it idle, and
`1A 2E` alone does not change the mode. **Drawing one pixel with `1A 2D` switches to matrix mode**, so send that
first (Sphero Edu does it implicitly at program start with `1A 2F 00 00 00`).

| Command | Payload | Result |
| --- | --- | --- |
| `1A 2E` Set Compressed Frame Player | 64 × (r g b) = 192 bytes, row by row starting at pixel (row 0, col 0) | whole 8×8 picture at once. Pixel 0 is a corner of the screen. |
| `1A 35` Delete All Animations And Frames | — | clears saved frames |
| `1A 30` Save 64 Bit Frame | frame index (uint16), then 4 bit-planes × 8 bytes | stores one frame of palette indices (0–15) |
| `1A 31` Save Animation | index, fps, fade (0/1), palette count, palette (r g b each), frame count (uint16), frame indices (uint16 each) | defines an animation |
| `1A 43` Play Animation With Loop Option | index, loop (0/1) | plays it; the ball sends `1A 3F` when stopped |
| `1A 38` Reset Animation | — | stops it |

Frame packing for `1A 30` (from Sphero Edu's code, confirmed on the ball): visit pixels **column by column (col 0→7),
and within each column from row 7 up to row 0**; the n-th pixel visited is bit n. Each palette index contributes one
bit to each of four 64-bit planes, **bit 0 plane first**. Each plane is sent big-endian with the upper 32 bits first.
With this packing, an animation frame and the same picture drawn with `1A 2E` look identical.

Packing frames as one 4-bit index per pixel instead gives a blank screen with a couple of blinking red dots.

Sphero Edu itself saves animations with `1A 40` (assign frames) and `1A 41` (save without frames), but its code
skips a zero animation index or a false fade flag, so we use `1A 31` with every field present.

## Driving (DID `16`)

| Command | Payload | Meaning | Edu function | Status |
| --- | --- | --- | --- | --- |
| `16 07` | speed, heading(2), flags | roll at speed toward heading (0 = aim direction, clockwise) | `setHeading`, `setSpeed`, `stopRoll`, Drive mode | Recorded, Tested |
| `16 06` | — | reset aim: current facing becomes heading 0 | `resetAim`, Aim "done" | Recorded, Tested |
| `16 51` | 0/1 | **Stop With Default Deceleration And Stabilization**: stops, then stabilization off/on. Edu's `setStabilization` (BOLT used `16 0C`, absent here) | `setStabilization` | Recorded, Tested |
| `16 4C` | yaw(int16), speed, seconds(float32) | Drive Time At Yaw Normalized; ball sends `16 4D` (Reached End Drive For Time) | `roll(h, s, t)` | Recorded |
| `16 49` | yaw(int16), speed, meters(float32) | Drive Distance At Yaw Normalized; ball sends `16 4E` (Reached End Drive To Distance) | `rollToDistance` | Recorded |
| `16 44` | — | Get Active Control System Id. During timed/distance rolls it answers 15 = temporospatial_vector_drive; idle BP-7314 answered 17 (beyond Sphero's list) | — | Recorded, Tested |
| `16 01` | modeL, powerL, modeR, powerR | raw motors (mode 1 forward, 2 reverse); Edu turns stabilization off first | `rawMotor` | Recorded |
| `16 35` | turn(int8), speed(int8), flags | Drive Rc Normalized (spins in place fast) | — | Tested |
| `16 33` | left(int8), right(int8) | Drive Tank Normalized | — | Probed |
| `16 32`, `16 34`, `16 36`, `16 37` | 8, 9, 8, 3 bytes | not in Sphero Edu's table; never used by Edu | — | Probed |
| `16 0F` | ? | ran when probed with zero bytes; the spherov2 library calls this "pitch torque modification" | — | Probed (avoid) |
| `16 3F` (async) | — | Robot Has Stopped Notify | — | Recorded |

Speeds: Edu's speed 40 became `0x1A` in `16 4C`/`16 49` but `0x34` in `16 07` from `setSpeed`. Edu Drive mode at
full speed sends `0xA6` (166). Treat the speed byte as raw 0–255 and scale in our own code.

`spin(360, 1)` sends no special command: Edu steps `16 07` headings about 8 times a second.

**Important:** Sphero Edu sends `16 51 00` (stabilization **off**) when any program ends, and the ball stays
limp until something turns it back on. Our site sends `16 51 01` after connecting.

## Sensors (DID `18`)

Streaming, as Sphero Edu configures it while a program runs:

```
18 00   interval(2 bytes, ms)  count(1)  mask(4)      Edu: 00 96 | 00 | 00 07 E0 78   (150 ms)
18 0C   extended mask(4)                              Edu: 03 84 00 00
```

The ball then sends `18 02` notifications with 14 big-endian float32 values (Tested, decoded on BP-7314):

| # | Value | Units |
| --- | --- | --- |
| 0–2 | pitch, roll, yaw | degrees (yaw is counter-clockwise positive, so heading 90 reads about -90) |
| 3–5 | acceleration x, y, z | g (z ≈ 1 at rest) |
| 6–7 | location x, y | meters from program start |
| 8–9 | velocity x, y | meters per second |
| 10–12 | gyroscope x, y, z | degrees per second |
| 13 | ambient light | lux |

Other sensor commands:

| Command | Payload | Meaning | Status |
| --- | --- | --- | --- |
| `18 30` | — | ambient light, float32 lux | Tested (199 lux indoors) |
| `18 13` | — | reset location to 0,0 | Recorded |
| `18 47` | `00 01 00 FA` | Configure Sensitivity Based Collision Detection: accelerometer method, sensitivity 1 = "very high" (0 super high … low), 250 ms dead time | Recorded |
| `18 48` | 01 | enable collision notifications; ball sends `18 49` on a bump | Recorded |
| `18 0F` | 01 | enable "gyro max" notifications | Recorded |
| `18 5A` | `4B 82` | Configure Collision Threshold (two bytes); Edu sends it at connect and this ball rejects it (error `07`) | Recorded |
| `18 22` | — | Get Bot To Bot Infrared Readings; BP-7314 answered `04 04 04 04` (all four receivers seeing a signal) | Tested |
| `18 25` | — | original BOLT "calibrate compass": **unknown command on BOLT+** | Tested |

**No compass.** Edu's API marks `calibrateCompass`, `setCompassDirection`, `getCompassDirection` as BOLT only.
Forward must be set with Aim.

## Infrared (DID `18`)

| Command | Payload | Edu function |
| --- | --- | --- |
| `18 27` | far near | `startIRBroadcast(near, far)` |
| `18 29` | — | `stopIRBroadcast` |
| `18 28` | far near | `startIRFollow` |
| `18 32` | — | `stopIRFollow` |
| `18 33` | far near | `startIREvade` |
| `18 34` | — | `stopIREvade` |
| `18 3F` | channel, 4 × intensity | `sendIRMessage(channel, intensity)` |
| `18 3E` | 0/1 | IR message notifications off/on (`listenForIRMessage`) |

All Recorded with one ball (nothing to follow, so behavior not observed).

## Power and system info

| Command | Meaning | Reply seen | Status |
| --- | --- | --- | --- |
| `13 0D` | wake | — | Tested |
| `13 10` | battery percent | e.g. `32` = 50% | Tested; Edu polls every 10 s |
| `13 03` | battery voltage (Mini) | error `02`: not on BOLT+ | Tested |
| `13 17` | battery voltage state | `01` | Recorded |
| `13 1B` 01 | enable battery-state notifications | — | Recorded |
| `13 1F` | charger state | `01` | Recorded |
| `13 20` 01 | enable charger notifications | — | Recorded |
| `11 00` | firmware version | 6 bytes | Recorded |
| `11 03` | board revision | `02` | Recorded |
| `11 13` | stats id | 2 bytes | Recorded |
| `11 33` | manufacturing date | `07E9 03 15` = 2025-03-21 | Recorded |
| `11 38` | SKU | ASCII | Recorded |
| `11 47` | Get Uid (6-byte unique id) | — | Recorded |
| `1D 15` | Get Current Application Id: `01` = main app (`00` would be bootloader) | — | Recorded |

## What Sphero Edu sends

**On connect:** `1D 15`, wake, `11 38`, `11 00` ×2, `11 13`, `13 17`, `13 1B 01`, `13 20 01`, `11 47`,
all LEDs white, clear screen, default face, collision setup (`18 47`, `18 5A`, `18 48`, `18 0F`), streaming off,
`13 1F`, `11 47`, `11 03`, `11 33`, then battery percent every 10 s.

**Program start:** LEDs off, back LED off, matrix black, stop, reset location, reset aim, stabilization on,
clear screen, `15 12 01`, streaming on (masks above).

**Program end:** streaming off, stop, all IR off, IR messages off, **stabilization off**, clear matrix,
matrix rotation 0, matrix fps reset, clear screen, default face, LEDs white, `15 12 00`.

**Aim (Drive mode):** all LEDs off, back LED blue (`1A 1A` mask `3FFFF`, only channel 5 = FF), matrix black,
aim screen (`15 10 … 02 01`), `16 07` speed 0 at the chosen heading while rotating, then on Done:
LEDs off, `16 06` reset aim, clear screen, default face, LEDs white.

**Drive mode:** `16 51 01`, `16 06`, then `16 07` resent about every 500 ms (full speed `A6`).

**Events** (`registerEvent`): send nothing. Edu detects collisions, freefall, landing, charging, etc. from the
stream and from the notifications it enabled at connect.

## Turning observations

- Standing still, `16 07` turns the ball to the new heading in under 0.5 s (yaw from the stream, both balls).
- While rolling at raw speed 60, the inner drive also swung 90° in about 0.2 s, but the ball then barely moved
  while the drive tilted 35–70°. This looked like the ball pushing against an obstacle; the test ran unattended.
  Repeat with someone watching before changing how our site turns.

## Traction and speed on carpet (BP-7314, 2026-10-09, measured from the sensor stream)

One-second drives at raw speed 70, same sequence twice:

| Drive | No covering | Covering on |
| --- | --- | --- |
| forward / backward / right / left / diagonal | 7 / 13 / 3 / 21 / 15 cm | 25 / 13 / 9 / 18 / 19 cm |
| total | 59 cm | 84 cm |

With covering on: speed 200 forward went 115 cm in 1.1 s (peak 123 cm/s, drive tilt 77°); speed 255 went only
46 cm (peak 70 cm/s, tilt 80°, includes turning around first). Turning 90° while rolling at 200: the path turned
70° after 0.63 s, drive tilt reached 110°, and it looked like a wide curve. The teacher rated 200 and 255 "about
right" and 150 "too slow". The BOLT+ page defaults to 200.

High drive tilt with little movement means the drive is climbing the inside of the shell instead of rolling it.

## Read-only queries answered by BP-7314

Every no-argument "Get" command from Sphero's table (except factory-test and firmware-update devices), sent
2026-10-09. Nothing moves. Highlights:

| Query | Answer |
| --- | --- |
| Get Supported Dids (`10 05`) | `10 11 12 13 15 16 18 19 1A 1B 1D 1F 21 23` (`1B`, `21`, `23` are not in Sphero Edu's table) |
| Get Api Protocol Version (`10 01`) | 2.1 |
| Get Processor Name (`11 1F`) | "Nordic" (one processor) |
| Get Main App / Bootloader Version (`11 00` / `11 01`) | 2.24.1610 / 2.3.418 |
| Get Sku (`11 38`) | "0600" |
| Get Boot Reason (`11 20`) | 0 |
| Get Core Up Time (`11 39`) | about 52 minutes |
| Get Battery Voltage State Thresholds (`13 26`) | 3.55 V, 3.65 V, 0.005 (float32) |
| Get Battery Adc Reading (`13 22`) | 2556 |
| Get Display Mode (`15 01`) | 2 = color (0 idle, 1 text, 2 color, 3 matrix, 4 animation, 5 sensor) |
| Get Display Protection Status (`15 0C`) | 0 = ok |
| Get Bluetooth Advertising Name (`19 05`) | "BP-7314" |

Answered "not supported" (error `02`): Get Mac Address, Get Model Number, Get Last Error Info, Get Three Character
Sku, Get Sos Message, Get Battery Voltage, Get Battery State, Get Motor Fault State, Get Drive Target Slew
Parameters, Get Rgbc Sensor Values, Get Current Detected Color Reading, Get Motor Thermal Protection Status,
Get Active Color Palette.

## Still to capture

`listenForIRMessage` receiving a message (needs two balls), `registerSoftwareButton` payloads, `speak` (runs on the
device, likely no Bluetooth). Device groups `1B`, `21`, `23` are supported by the ball but absent from Sphero's table.
