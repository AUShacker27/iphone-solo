const MAX_TILT = 40;
const DEAD_ZONE = 2;
const SHIFT = 28;
const SMOOTHING = 0.14;

const root = document.documentElement.style;
const gate = document.querySelector('.gate');

const DEG = Math.PI / 180;

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
const tilt = { x: 0, y: 0 };
const eased = { x: 0, y: 0 };
let origin = null;
let veil = 1;
let started = false;

function onOrientation(e) {
  if (e.alpha == null || e.beta == null || e.gamma == null) return;

  if (!origin) origin = axesOf(e.alpha, e.beta, e.gamma);

  const n = axesOf(e.alpha, e.beta, e.gamma)[2];
  const x = dot(origin[0], n);
  const y = dot(origin[1], n);
  const z = dot(origin[2], n);

  const angle = Math.atan2(Math.hypot(x, y), z) / DEG;
  const len = Math.hypot(x, y) || 1;

  tilt.x = (x / len) * angle;
  tilt.y = (-y / len) * angle;
}

// Render loop
function smoothstep(t) {
  t = Math.min(1, Math.max(0, t));
  return t * t * (3 - 2 * t);
}

let angle = 270;

function frame() {
  eased.x += (tilt.x - eased.x) * SMOOTHING;
  eased.y += (tilt.y - eased.y) * SMOOTHING;
  if (started) veil *= 0.94;

  const dist = Math.hypot(eased.x, eased.y);
  const fold = Math.max(veil, smoothstep((dist - DEAD_ZONE) / (MAX_TILT - DEAD_ZONE)));
  if (dist > DEAD_ZONE) angle = Math.atan2(-eased.x, eased.y) / DEG;

  root.setProperty('--fold', fold.toFixed(3));
  root.setProperty('--shift-x', `${(-eased.x / MAX_TILT * SHIFT).toFixed(1)}px`);
  root.setProperty('--shift-y', `${(-eased.y / MAX_TILT * SHIFT).toFixed(1)}px`);
  root.setProperty('--void-angle', `${angle.toFixed(1)}deg`);
  root.setProperty('--void-edge', `${(fold * 90 - 40).toFixed(1)}%`);
  root.setProperty('--void-soft', `${(fold * 90).toFixed(1)}%`);

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
  const nx = e.clientX / innerWidth * 2 - 1;
  const ny = e.clientY / innerHeight * 2 - 1;
  tilt.x = nx * MAX_TILT;
  tilt.y = ny * MAX_TILT;
}

gate.addEventListener('click', async () => {
  const gyro = await requestGyro();
  if (!gyro) window.addEventListener('pointermove', onPointer);
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
