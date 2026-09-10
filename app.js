const DEFAULT_IMAGE = 'backgrounds/default.png';
const FOLLOW = 16;

const canvas = document.querySelector('.stage');
const gate = document.querySelector('.gate');

// Standalone flag
if (navigator.standalone || matchMedia('(display-mode: standalone)').matches) {
  document.documentElement.classList.add('is-standalone');
}

// Renderer
const renderer = createRenderer(canvas);
if (!renderer) {
  gate.querySelector('.gate__hint').textContent = 'This needs WebGL 2';
}

renderer?.load(DEFAULT_IMAGE);

// Gravity roll
let target = 0;
let display = 0;
let unwrapped = null;
let previous = null;

function wrap(value) {
  return ((value + 180) % 360 + 360) % 360 - 180;
}

function onMotion(e) {
  const total = e.accelerationIncludingGravity;
  const linear = e.acceleration;
  if (!total || !linear) return;

  const x = total.x - linear.x;
  const z = total.z - linear.z;
  if (!Number.isFinite(x) || !Number.isFinite(z) || Math.hypot(x, z) < 0.5) return;

  const roll = Math.atan2(x, -z) * 180 / Math.PI;
  if (unwrapped === null) {
    unwrapped = roll;
  } else {
    unwrapped += wrap(roll - (previous ?? wrap(unwrapped)));
  }
  previous = roll;

  target = Math.max(-180, Math.min(180, -2 * unwrapped));
}

document.addEventListener('visibilitychange', () => {
  previous = null;
});

// Render loop
let lastTime = null;

function frame(time) {
  const dt = lastTime === null ? 1 / 60 : Math.min((time - lastTime) / 1000, 0.1);
  lastTime = time;

  display += (target - display) * (1 - Math.exp(-dt * FOLLOW));
  if (Math.abs(target - display) < 0.001) display = target;

  renderer?.draw(Math.min(Math.abs(display) / 180, 1), display >= 0 ? 0 : 1);
  requestAnimationFrame(frame);
}

// Motion permission
async function requestMotion() {
  if (typeof DeviceMotionEvent === 'undefined') return false;

  if (typeof DeviceMotionEvent.requestPermission === 'function') {
    try {
      const state = await DeviceMotionEvent.requestPermission();
      if (state !== 'granted') return false;
    } catch {
      return false;
    }
  }

  window.addEventListener('devicemotion', onMotion);
  return true;
}

gate.addEventListener('click', async () => {
  await requestMotion();
  gate.classList.add('is-hidden');
}, { once: true });

requestAnimationFrame(frame);
