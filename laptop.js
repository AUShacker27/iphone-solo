const BRIDGE_URL = 'http://127.0.0.1:8471/lid';
const CLOSED_ANGLE = 15;
const WHEEL_STEP = 1 / 1200;
const KEY_STEP = 0.05;
const LID_SENSOR = { vendorId: 0x05AC, productId: 0x8104, usagePage: 0x20, usage: 0x8A };
const ANGLE_REPORT = 1;
const SLOW_FOLLOW = 3;

// Laptop: the lid angle drives the lid fold
function createLaptopScene(canvas) {
  const lidSheet = document.querySelector('.sheet--lid');
  const lidStatus = lidSheet.querySelector('.sheet__status');
  const allow = lidSheet.querySelector('[data-action="allow"]');
  const preview = lidSheet.querySelector('[data-action="preview"]');
  const renderer = createLid(canvas);
  const hid = navigator.hid;

  let target = 0;
  let display = 0;
  let follow = FOLLOW;
  let open = null;
  let live = false;
  let lastReport = 0;

  document.documentElement.classList.add(hid ? 'has-hid' : 'no-hid');

  function clamp(value) {
    return Math.min(1, Math.max(0, value));
  }

  function setStatus(text) {
    lidStatus.textContent = text;
    lidStatus.hidden = !text;
  }

  function begin(gesture) {
    if (lidSheet.open) lidSheet.close();
    if (live) {
      showHint(gesture);
      return;
    }
    live = true;
    hideUnavailable();
    onboard(() => showHint(gesture));
  }

  function onAngle(angle) {
    if (!Number.isFinite(angle)) return;
    if (open === null || angle > open) open = angle;
    target = clamp((open - angle) / (open - CLOSED_ANGLE));
  }

  // Sensor
  function isLidSensor(device) {
    return device.collections.some(
      (collection) => collection.usagePage === LID_SENSOR.usagePage && collection.usage === LID_SENSOR.usage,
    );
  }

  function onReport(e) {
    if (e.reportId !== ANGLE_REPORT || e.data.byteLength < 2) return;
    const now = performance.now();
    const gap = Math.min(1, (now - lastReport) / 1000);
    lastReport = now;
    follow = Math.min(FOLLOW, Math.max(SLOW_FOLLOW, 4 / gap));
    onAngle(e.data.getUint16(0, true));
  }

  async function listen(device) {
    if (!device.opened) await device.open();
    device.addEventListener('inputreport', onReport);
    begin('Close the lid slowly to fold the picture.');
  }

  async function reconnect() {
    if (!hid) return;
    const device = (await hid.getDevices()).find(isLidSensor);
    if (device) await listen(device);
  }

  async function allowSensor() {
    setStatus('');
    allow.disabled = true;
    try {
      const [device] = await hid.requestDevice({ filters: [LID_SENSOR] });
      if (!device) {
        setStatus('No sensor was picked. It ships in MacBooks from 2019 on.');
        return;
      }
      await listen(device);
    } catch (error) {
      setStatus(error.message || 'The lid sensor could not be opened.');
    } finally {
      allow.disabled = false;
    }
  }

  // Bridge
  function connectBridge() {
    const source = new EventSource(BRIDGE_URL);
    source.onmessage = (e) => onAngle(Number(e.data));
    source.onopen = () => {
      follow = FOLLOW;
      begin('Close the lid slowly to fold the picture.');
    };
  }

  // Preview
  window.addEventListener('wheel', (e) => {
    follow = FOLLOW;
    target = clamp(target + e.deltaY * WHEEL_STEP);
  }, { passive: true });

  window.addEventListener('keydown', (e) => {
    follow = FOLLOW;
    if (e.key === 'ArrowDown') target = clamp(target + KEY_STEP);
    if (e.key === 'ArrowUp') target = clamp(target - KEY_STEP);
  });

  allow.addEventListener('click', allowSensor);

  preview.addEventListener('click', () => {
    begin('Scroll or use the arrow keys to fold the picture.');
  });

  lidSheet.addEventListener('cancel', (e) => e.preventDefault());

  return {
    defaultImage: 'backgrounds/default-mac.png',
    storageKey: 'background-mac',
    renderer,
    live: () => live,
    async start() {
      connectBridge();
      await reconnect();
      if (!live) lidSheet.showModal();
    },
    frame(dt) {
      display += (target - display) * (1 - Math.exp(-dt * follow));
      if (Math.abs(target - display) < 0.0001) display = target;
      renderer.draw(display);
    },
  };
}
