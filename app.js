const DEFAULT_IMAGE = 'backgrounds/default.png';
const FOLLOW = 16;
const HINT_MS = 7000;
const SENSOR_WAIT_MS = 4000;
const INSTALL_DELAY_MS = 1200;
const INSTALL_KEY = 'install-shown';

const canvas = document.querySelector('.stage');
const actions = document.querySelector('.actions');
const hint = document.querySelector('.hint');
const unavailable = document.querySelector('.unavailable');
const status = unavailable.querySelector('.unavailable__status');
const retry = unavailable.querySelector('[data-action="retry"]');
const motionCard = document.querySelector('.card--motion');
const enable = motionCard.querySelector('[data-action="enable"]');
const installCard = document.querySelector('.card--install');
const fullscreen = document.querySelector('[data-action="fullscreen"]');

// Launch mode
const launchedAsApp = Boolean(navigator.standalone)
  || ['fullscreen', 'standalone', 'minimal-ui'].some((mode) => matchMedia(`(display-mode: ${mode})`).matches);

if (launchedAsApp) document.documentElement.classList.add('is-app');

// Hint
let hintTimer;

function showHint(text, ms = HINT_MS) {
  clearTimeout(hintTimer);
  hint.textContent = text;
  hint.hidden = false;
  if (ms) hintTimer = setTimeout(() => { hint.hidden = true; }, ms);
}

// Unavailable
function showUnavailable(message = '') {
  if (motionCard.open) motionCard.close();
  unavailable.hidden = false;
  status.textContent = message;
  status.hidden = !message;
  retry.hidden = !message;
}

// Renderer
const renderer = createRenderer(canvas);

if (renderer) {
  renderer.load(DEFAULT_IMAGE);
} else {
  showUnavailable('This browser has no WebGL 2.');
}

// Gravity roll
let target = 0;
let display = 0;
let unwrapped = null;
let previous = null;
let hasGravity = false;
let sensorTimer;

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

  if (!hasGravity) {
    hasGravity = true;
    clearTimeout(sensorTimer);
    unavailable.hidden = true;
  }

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
let motionEnabled = false;
let pending = false;

async function enableMotion(fromTap = false) {
  if (!isSecureContext || typeof DeviceMotionEvent === 'undefined') {
    showUnavailable();
    return;
  }
  if (motionEnabled || pending) return;

  pending = true;
  enable.disabled = true;
  retry.disabled = true;

  try {
    if (typeof DeviceMotionEvent.requestPermission === 'function') {
      const state = await DeviceMotionEvent.requestPermission();
      if (state !== 'granted') {
        showUnavailable('Motion access is off. Allow it for this page in Safari settings, then try again.');
        return;
      }
    }

    motionEnabled = true;
    if (motionCard.open) motionCard.close();
    window.addEventListener('devicemotion', onMotion);
    if (!offerInstall()) showGesture();
    sensorTimer = setTimeout(() => {
      if (!hasGravity) showUnavailable();
    }, SENSOR_WAIT_MS);
  } catch {
    if (fromTap) {
      showUnavailable('Motion access failed. Tap Enable motion to try again.');
    } else if (!motionCard.open) {
      motionCard.showModal();
    }
  } finally {
    pending = false;
    enable.disabled = false;
    retry.disabled = false;
  }
}

enable.addEventListener('click', () => enableMotion(true));
retry.addEventListener('click', () => enableMotion(true));
motionCard.addEventListener('cancel', (e) => e.preventDefault());

// Install guide
function showGesture() {
  showHint('Face the screen toward the sky, then roll the phone left or right.');
}

function offerInstall() {
  if (launchedAsApp || localStorage.getItem(INSTALL_KEY)) return false;

  setTimeout(() => {
    localStorage.setItem(INSTALL_KEY, '1');
    installCard.showModal();
  }, INSTALL_DELAY_MS);
  return true;
}

installCard.addEventListener('close', showGesture);

if (!document.fullscreenEnabled) fullscreen.textContent = 'Add to Home Screen';

fullscreen.addEventListener('click', async () => {
  if (document.fullscreenElement) {
    await document.exitFullscreen();
  } else if (document.fullscreenEnabled) {
    await document.documentElement.requestFullscreen();
  } else {
    installCard.showModal();
  }
});

document.addEventListener('fullscreenchange', () => {
  fullscreen.textContent = document.fullscreenElement ? 'Exit fullscreen' : 'Fullscreen';
});

// Controls toggle
canvas.addEventListener('click', () => {
  if (!hasGravity) return;
  actions.classList.toggle('is-hidden');
});

enableMotion();
requestAnimationFrame(frame);
