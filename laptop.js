const BRIDGE_URL = 'http://127.0.0.1:8471/lid';
const CLOSED_ANGLE = 15;
const WHEEL_STEP = 1 / 1200;
const KEY_STEP = 0.05;

// Laptop: the lid angle drives the lid fold
function createLaptopScene(canvas) {
  const lidCard = document.querySelector('.card--lid');
  const bridgeStatus = lidCard.querySelector('.card__status');
  const preview = lidCard.querySelector('[data-action="preview"]');
  const renderer = createLid(canvas);

  let target = 0;
  let display = 0;
  let open = null;
  let live = false;

  function clamp(value) {
    return Math.min(1, Math.max(0, value));
  }

  function begin(gesture) {
    if (lidCard.open) lidCard.close();
    if (live) {
      showHint(gesture);
      return;
    }
    live = true;
    hideUnavailable();
    onboard(() => showHint(gesture));
  }

  // Bridge
  function onAngle(angle) {
    if (!Number.isFinite(angle)) return;
    if (open === null || angle > open) open = angle;
    target = clamp((open - angle) / (open - CLOSED_ANGLE));
  }

  function connect() {
    const source = new EventSource(BRIDGE_URL);
    source.onmessage = (e) => onAngle(Number(e.data));
    source.onopen = () => {
      bridgeStatus.textContent = 'Bridge connected.';
      begin('Close the lid slowly to fold the picture.');
    };
    source.onerror = () => {
      bridgeStatus.textContent = 'Waiting for the bridge…';
    };
  }

  // Preview
  window.addEventListener('wheel', (e) => {
    target = clamp(target + e.deltaY * WHEEL_STEP);
  }, { passive: true });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') target = clamp(target + KEY_STEP);
    if (e.key === 'ArrowUp') target = clamp(target - KEY_STEP);
  });

  preview.addEventListener('click', () => {
    begin('Scroll or use the arrow keys to fold the picture.');
  });

  lidCard.addEventListener('cancel', (e) => e.preventDefault());

  return {
    defaultImage: 'backgrounds/default-mac.png',
    storageKey: 'background-mac',
    renderer,
    live: () => live,
    start() {
      connect();
      lidCard.showModal();
    },
    frame(dt) {
      display += (target - display) * (1 - Math.exp(-dt * FOLLOW));
      if (Math.abs(target - display) < 0.0001) display = target;
      renderer.draw(display);
    },
  };
}
