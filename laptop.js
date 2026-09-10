const BRIDGE_URL = 'http://127.0.0.1:8471/lid';
const CLOSED_ANGLE = 15;
const WHEEL_STEP = 1 / 1200;
const KEY_STEP = 0.05;
const LID_VENDOR = 0x05AC;
const LID_PRODUCT = 0x8104;
const LID_USAGE_PAGE = 0x20;
const LID_USAGE = 0x8A;
const LID_FILTERS = [
  { vendorId: LID_VENDOR, productId: LID_PRODUCT, usagePage: LID_USAGE_PAGE, usage: LID_USAGE },
  { vendorId: LID_VENDOR, productId: LID_PRODUCT },
  { vendorId: LID_VENDOR, usagePage: LID_USAGE_PAGE, usage: LID_USAGE },
];
const ANGLE_REPORT = 1;
const SLOW_FOLLOW = 3;

// Laptop: the lid angle drives the lid fold
function createLaptopScene(canvas) {
  const lidSheet = document.querySelector('.sheet--lid');
  const lidStatus = lidSheet.querySelector('.sheet__status');
  const allow = lidSheet.querySelector('[data-action="allow"]');
  const copy = lidSheet.querySelector('[data-action="copy"]');
  const preview = lidSheet.querySelector('[data-action="preview"]');
  const renderer = createLid(canvas);
  const hid = navigator.hid;

  let target = 0;
  let display = 0;
  let follow = FOLLOW;
  let open = null;
  let live = false;
  let lastReport = 0;
  let hidDevice = null;

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
    if (device.collections?.some((c) => c.usagePage === LID_USAGE_PAGE && c.usage === LID_USAGE)) {
      return true;
    }
    return device.vendorId === LID_VENDOR && device.productId === LID_PRODUCT;
  }

  function parseAngle(data) {
    const offset = data.byteLength > 2 && data.getUint8(0) === ANGLE_REPORT ? 1 : 0;
    if (data.byteLength < offset + 2) return NaN;
    let raw = data.getUint16(offset, true);
    if (raw > 360) raw /= 100;
    return raw;
  }

  function onReport(e) {
    if (e.reportId !== ANGLE_REPORT && e.reportId !== 0) return;
    const angle = parseAngle(e.data);
    if (!Number.isFinite(angle)) return;
    const now = performance.now();
    const gap = Math.min(1, (now - lastReport) / 1000);
    lastReport = now;
    follow = Math.min(FOLLOW, Math.max(SLOW_FOLLOW, 4 / gap));
    onAngle(angle);
  }

  async function listen(device) {
    if (hidDevice && hidDevice !== device) {
      try { hidDevice.removeEventListener('inputreport', onReport); } catch { /* already gone */ }
      try { await hidDevice.close(); } catch { /* already closed */ }
    }
    if (!device.opened) await device.open();
    hidDevice = device;
    device.addEventListener('inputreport', onReport);
    begin('Close the lid slowly to fold the picture.');
  }

  async function pickSensor(candidates) {
    return candidates.find((device) => {
      return device.collections?.some((c) => c.usagePage === LID_USAGE_PAGE && c.usage === LID_USAGE);
    }) || candidates.find(isLidSensor);
  }

  async function reconnect() {
    if (!hid) return false;
    const device = await pickSensor(await hid.getDevices());
    if (!device) return false;
    await listen(device);
    return true;
  }

  async function allowSensor() {
    setStatus('');
    allow.disabled = true;
    try {
      const picked = await hid.requestDevice({ filters: LID_FILTERS });
      const device = await pickSensor([...(await hid.getDevices()), ...picked]);
      if (!device) {
        setStatus('No lid sensor was selected. It ships in MacBooks from 2019 on.');
        return;
      }
      await listen(device);
    } catch (error) {
      setStatus(error.message || 'The lid sensor could not be opened.');
    } finally {
      allow.disabled = false;
    }
  }

  async function copyForChrome() {
    try {
      await navigator.clipboard.writeText(location.href);
      setStatus('Copied. Paste the link in Google Chrome, then allow the lid sensor.');
    } catch {
      setStatus(location.href);
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

  if (hid) {
    hid.addEventListener('connect', (e) => {
      if (isLidSensor(e.device)) listen(e.device);
    });
  }

  allow.addEventListener('click', allowSensor);
  copy.addEventListener('click', copyForChrome);
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
