# Sphero Drive

A one-page website for driving Sphero Minis from a Chromebook or laptop. No accounts, no app, no sign-in.
Connect, drive with a joystick / keyboard / game controller, change colors. That's it.

## Running it

Web Bluetooth only works over **https://** or from **localhost**, and only in **Chrome or Edge**
(Chromebooks, Mac, Windows, Android). Safari, Firefox, iPhones and iPads will not work.

**Quick local test on your own computer:**

```bash
python3 -m http.server 8765
```

then open http://localhost:8765 in Chrome.

**For a classroom**, put the site files (`index.html`, `bolt.html`, `style.css`, `sphero.js`, `app.js`) on any https host
and give students the link. Pick a host your school network allows.

## Classroom ritual

1. Take the Sphero off its charger and shake it until it lights up.
2. Click **Connect a Sphero**, pick the `SM-xxxx` entry, click **Pair**.
3. The ball blinks and glows its assigned color (red, blue, green, ...). The card on the page shows the same color.
4. Click the name on the card to rename it (names are remembered on that computer).
5. Click **Set which way is forward**, spin the ball until the small blue tail light points at you, click **Done**.

Tip: wake only the Sphero you want to connect. If several are awake nearby they all show up as `SM-xxxx`
in the chooser and it's a guessing game. If you grab the wrong one, press **Blink** to see which ball you got,
then **Remove** it and try again.

## Controls

Two students can drive two Spheros from one keyboard.

| Input | Drives | Turbo | Other |
| --- | --- | --- | --- |
| W A S D | the Sphero with the **WASD** badge | Left Shift | |
| Arrow keys | the Sphero with the **Arrows** badge | Right Shift | |
| On-screen joystick | the selected card | | |
| Game controller 1 | the WASD Sphero | right trigger | bumpers change color, A blinks |
| Game controller 2 | the Arrows Sphero | right trigger | bumpers change color, A blinks |

- The first Sphero connected gets WASD, the second gets Arrows. Click the badge on a card to swap or change it.
- With only one Sphero connected, both key sets and any controller drive it.
- Space stops every Sphero. Keys 1-9 select a card, and the color buttons, Aim, and B (blink) apply to the selected card.
- A third Sphero on the same computer gets no keys and drives with the joystick when selected. If one of the first two is removed, it inherits the free key set.

## BOLT+ page

`bolt.html` is a separate page for Sphero BOLT+ robots (Bluetooth names `BP-xxxx`). It drives the same way as the
Mini page, with the same Aim button. Each BOLT+ shows its color on all six lights and on its screen.

- Wake a BOLT+ by lifting it off its charger. Its screen shows a code; pick the same code in the Bluetooth list.
- The BOLT+ has no compass, so "forward" is set with Aim, for example toward a sign on the east wall.
- If a BOLT+ was last used in Sphero Edu, it may sit limp (Edu turns stabilization off when a program ends).
  Connecting here turns it back on.

Protocol notes for the BOLT+, with what was recorded, tested, or still unknown: `docs/BOLT_PLUS_PROTOCOL.md`.

## Files

- `index.html` – Mini page
- `bolt.html` – BOLT+ page
- `style.css` – styles shared by both pages
- `sphero.js` – small Sphero driver for the Mini and BOLT+ (Web Bluetooth + Sphero API v2 packets)
- `app.js` – UI, inputs, drive loop
