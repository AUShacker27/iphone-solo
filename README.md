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

On a laptop the hinge is real.
The fold hangs from the top edge of the screen
and grows from the bottom as the lid comes down.

## Install

1. Host the folder anywhere that serves it over HTTPS
   (motion access needs a secure origin).
2. Open it in Safari on the iPhone and allow motion when asked.
3. Share → Add to Home Screen.
4. Launch it from the icon for an edge to edge window.

The page also runs in a Safari tab,
where a Fullscreen pill explains the steps above.

## On a MacBook

Chrome can talk to the lid angle sensor directly through WebHID,
so nothing needs to be installed.

1. Open the site in Chrome (or another Chromium browser) on the Mac.
2. Click **Allow lid sensor** and pick the Apple device
   in Chrome's list. It may show up as an unknown device
   with the id `05ac:8104`.
3. Close the lid slowly.

Chrome does not remember the grant for this sensor
(it reports no serial number), so the sheet asks again
each time the page is opened.
The sensor sends its angle at least once a second;
the easing stretches over the gap between reports
so sparse updates still glide.
The widest angle seen counts as flat
and the fold completes at fifteen degrees.
The sensor ships in MacBooks from 2019 on.

Safari and Firefox have no WebHID,
so the sheet asks you to copy the page link into Google Chrome.
Trackpad preview (scroll or the arrow keys) is a fallback,
and the page also listens for the bridge below.
The Fullscreen pill uses the real fullscreen API here.

### The bridge

`bridge/lid-bridge.py` reads the same sensor with `hidapi`
and streams it on `127.0.0.1:8471/lid` sixty times a second.
Run it with plain `python3 lid-bridge.py`:
on first launch it creates a private virtualenv
under `~/Library/Application Support/iPhone Solo`
and installs `hidapi` there,
which sidesteps Homebrew's externally-managed-environment error.
Any browser connects to it on its own.

Device detection is a fine pointer with no touch points.
Append `?mode=laptop` or `?mode=phone` to force either.

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

The default pictures live in `backgrounds/`:
`default.png` for phones and `default-mac.png` for laptops.
To ship different ones, replace those files
or change `defaultImage` in `phone.js` and `laptop.js`.
Use a screenshot at the device's native resolution;
the blur is sampled from the image's own mip chain,
so a small picture goes soft sooner.
A photo chosen on the device is stored in IndexedDB,
separately per mode, and used until *Use default* is tapped.
Images are drawn with cover, so nothing is stretched
and there are no borders.

## How it works

Everything is drawn on a WebGL 2 canvas.
`gl.js` owns the shared stage: context, quad,
texture upload, the Gaussian mip chain built once per image,
cover mapping and the sampling helper.
The canvas is treated as the physical display:
each pixel is projected into a stationary image plane
that rotates about a hinge, with perspective,
so the span across the hinge stays painted
and only the margins along it open up.
Blur grows with the tilt and with the distance from the hinge,
then a glass tint, a faint reflection
and a black fade toward the far edge finish it,
and the geometry stops bending once the picture
would stretch past `MAX_STRETCH`.

The two folds are separate shaders:
`fold.js` puts the hinge on the left or right edge for phones,
`lid.js` puts it along the top edge for laptops.
`phone.js` reads gravity from `devicemotion`,
turns it into a roll angle, doubles it
and clamps it to a half turn.
`laptop.js` reads the lid angle from WebHID input reports,
or from the bridge when one is running.
Both ease toward their target every frame
and hand `app.js` a small scene object,
which keeps the hints, sheets, controls and render loop shared.

The guides are `<dialog>` sheets styled in `styles.css`,
each ending with a credit to
[Archie Auburn](https://www.instagram.com/archieauburn/).
