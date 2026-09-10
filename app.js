const MAX_TILT = 40;
const DEAD_ZONE = 2;
const SHIFT = 24;
const SMOOTHING = 0.14;

const root = document.documentElement.style;
const gate = document.querySelector('.gate');

const DEG = Math.PI / 180;

// Standalone flag
if (navigator.standalone || matchMedia('(display-mode: standalone)').matches) {
  document.documentElement.classList.add('is-standalone');
}

// Orientation math
function axesOf(alpha, beta, gamma) {
  const cX = Math.cos(beta * DEG), sX = Math.sin(beta * DEG);
  const cY = Math.cos(gamma * DEG), sY = Math.sin(gamma * DEG);
  const cZ = Math.cos(alpha * DEG), sZ = Math.sin(alpha * DEG);

  return [
    [cZ * cY - sZ * sX * sY, cY * sZ + cZ * sX * sY, -cX * sY],
    [-cX * sZ, cZ * cX, sX],
    [cY * sZ * sX + cZ * sY, sZ * sY - cZ * cY * sX, cX * cY],
  ];
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

// Tilt state
let tilt = 0;
let eased = 0;
let origin = null;
let veil = 1;
let started = false;

function onOrientation(e) {
  if (e.alpha == null || e.beta == null || e.gamma == null) return;

  if (!origin) origin = axesOf(e.alpha, e.beta, e.gamma);

  const n = axesOf(e.alpha, e.beta, e.gamma)[2];
  const x = dot(origin[0], n);
  const z = dot(origin[2], n);

  tilt = Math.atan2(x, z) / DEG;
}

// Render loop
function smoothstep(t) {
  t = Math.min(1, Math.max(0, t));
  return t * t * (3 - 2 * t);
}

let side = 1;

function frame() {
  eased += (tilt - eased) * SMOOTHING;
  if (started) veil *= 0.94;

  const dist = Math.abs(eased);
  const fold = Math.max(veil, smoothstep((dist - DEAD_ZONE) / (MAX_TILT - DEAD_ZONE)));
  if (dist > DEAD_ZONE) side = Math.sign(eased);

  const shift = fold * SHIFT;

  root.setProperty('--fold', fold.toFixed(3));
  root.setProperty('--shift', `${(-side * shift).toFixed(1)}px`);
  root.setProperty('--void-side', side > 0 ? 'to left' : 'to right');
  root.setProperty('--void-edge', `calc(${shift.toFixed(1)}px + ${(fold * fold * 50).toFixed(1)}%)`);
  root.setProperty('--void-soft', `calc(${shift.toFixed(1)}px + ${(fold * fold * 50 + fold * 45).toFixed(1)}%)`);

  requestAnimationFrame(frame);
}

// Gyro permission
async function requestGyro() {
  if (typeof DeviceOrientationEvent === 'undefined') return false;

  if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    try {
      const state = await DeviceOrientationEvent.requestPermission();
      if (state !== 'granted') return false;
    } catch {
      return false;
    }
  }

  window.addEventListener('deviceorientation', onOrientation);
  return true;
}

// Pointer fallback
function onPointer(e) {
  tilt = (e.clientX / innerWidth * 2 - 1) * MAX_TILT;
}

gate.addEventListener('click', async () => {
  const gyro = await requestGyro();
  setTimeout(() => {
    if (!gyro || !origin) window.addEventListener('pointermove', onPointer);
  }, 1000);
  gate.classList.add('is-hidden');
  started = true;
}, { once: true });

// Recenter
let lastTap = 0;

document.addEventListener('pointerdown', (e) => {
  if (e.timeStamp - lastTap < 300) origin = null;
  lastTap = e.timeStamp;
});

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) origin = null;
});

requestAnimationFrame(frame);
