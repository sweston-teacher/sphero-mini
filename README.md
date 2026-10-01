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

**For a classroom**, put the three files (`index.html`, `sphero.js`, `app.js`) on any https host.
GitHub Pages is free and works well: make a repo, upload the files, turn on Pages in the repo settings,
and give students the link.

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

| Input | Drive | Other |
| --- | --- | --- |
| On-screen joystick | drag | |
| Keyboard | WASD / arrows, Shift = turbo | Space = stop, 1-9 = pick robot, B = blink |
| Game controller | left stick or D-pad, right trigger = turbo | bumpers change color, A = blink |

Each computer can connect several Spheros. Keys 1-9 or clicking a card picks which one the controls drive.

## Files

- `index.html` – page and styles
- `sphero.js` – small Sphero Mini driver (Web Bluetooth + Sphero API v2 packets)
- `app.js` – UI, inputs, drive loop
