# iPhone Solo

The iPhone Duo fold animation for phones that do not fold.

When the Duo opens or closes,
the picture on its screen stays where it is in space
while the hardware sweeps through it:
the image frosts over and slips into black
without ever changing its size.
iPhone Solo does the same thing on a regular iPhone,
driven by the gyroscope instead of a hinge.
Hold the phone still and the picture is sharp.
Tilt it and the picture stays put, frosts over
and disappears into the void from the receding edge.

## Install

1. Host the folder anywhere that serves it over HTTPS
   (GitHub Pages works, and motion access needs a secure origin).
2. Open it in Safari on the iPhone.
3. Share → Add to Home Screen.
4. Launch it from the icon and tap once to grant motion access.

The page also runs in a normal tab,
but the effect is meant for the edge to edge standalone window.

## Gestures

| Gesture        | Action                                  |
| -------------- | --------------------------------------- |
| Tap            | Grant motion access and unfold          |
| Double tap     | Recenter, current pose becomes neutral  |
| Long press     | Choose a background photo               |

The origin is also reset every time the app comes back
from the background.

## Backgrounds

The default picture lives in `backgrounds/default.png`.
To ship a different one, replace that file
or point `--bg` in `styles.css` at another path.

On the phone, hold the screen to open the sheet,
pick a photo and it is stored on the device
and used until you choose *Use Default*.

## Tuning

The feel is controlled by a few constants at the top of `app.js`:

- `MAX_TILT` — degrees of tilt for a full fold
- `DEAD_ZONE` — degrees ignored around the neutral pose
- `SHIFT` — how far the picture counter-moves at full tilt, in pixels
- `SMOOTHING` — how quickly the effect follows the sensor

The look itself is in `styles.css`,
where the `.content`, `.layer--frost` and `.void` rules
read a single `--fold` progress variable.

## Without a gyroscope

On a desktop, or when motion access is denied,
the cursor position drives the same tilt
so the effect can still be previewed.
