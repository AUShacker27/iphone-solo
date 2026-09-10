# iPhone Solo

The iPhone Duo fold animation for phones that do not fold.

When the Duo opens or closes,
the picture on its screen stays where it is in space
while the hardware sweeps through it:
the image frosts over and slips into black
without ever changing its size.
iPhone Solo does the same thing on a regular iPhone,
driven by gravity instead of a hinge.
Hold the phone flat, screen to the sky, and the picture is sharp.
Roll it left or right, like closing a book,
and the display folds away from the edge you lift.

## Install

1. Host the folder anywhere that serves it over HTTPS
   (motion access needs a secure origin).
2. Open it in Safari on the iPhone and allow motion when asked.
3. Share → Add to Home Screen.
4. Launch it from the icon for an edge to edge window.

The page also runs in a Safari tab,
where a Fullscreen pill explains the steps above.

## Controls

Pills at the top of the screen:

- **Choose image** — pick a photo from the library
- **Use default** — go back to `backgrounds/default.png`
  (shown only while a custom photo is set)
- **Fullscreen** and **GitHub** — shown only in a browser tab

Tap the picture to hide or show the pills.
They stay visible until a custom photo is chosen,
after that they start hidden.

## Backgrounds

The default picture lives in `backgrounds/default.png`.
To ship a different one, replace that file
or change `DEFAULT_IMAGE` at the top of `app.js`.
A photo chosen on the phone is stored on the device
in IndexedDB and used until *Use default* is tapped.
Images are drawn with cover, so nothing is stretched
and there are no borders.

## How it works

`render.js` draws everything on a WebGL 2 canvas.
The canvas is treated as the physical display:
each pixel is projected into a stationary image plane
that rotates about a hinge at the left or right edge,
with perspective, so the whole width stays painted
and only the top and bottom margins open up.
Blur is sampled from a Gaussian mip chain
built once whenever an image is loaded,
and grows with the tilt and with the distance from the hinge.
A glass tint, a faint reflection
and a black fade toward the far edge finish it.

`app.js` reads gravity from `devicemotion`,
turns it into a roll angle, doubles it
and clamps it to a half turn,
then eases toward it every frame.
