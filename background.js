const DB_NAME = 'solo';
const STORE = 'settings';
const KEY = 'background';
const HOLD_MS = 600;

const sheet = document.querySelector('.sheet');
const picker = document.querySelector('.picker');

// Storage
function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore(mode, run) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = run(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const load = () => withStore('readonly', (s) => s.get(KEY));
const save = (blob) => withStore('readwrite', (s) => s.put(blob, KEY));
const clear = () => withStore('readwrite', (s) => s.delete(KEY));

// Apply
let url = null;

function applyBackground(blob) {
  if (url) URL.revokeObjectURL(url);
  url = blob ? URL.createObjectURL(blob) : null;

  if (url) {
    document.documentElement.style.setProperty('--bg', `url("${url}")`);
  } else {
    document.documentElement.style.removeProperty('--bg');
  }
}

load().then(applyBackground).catch(() => {});

// Sheet
function openSheet() {
  sheet.hidden = false;
}

function closeSheet() {
  sheet.hidden = true;
}

sheet.addEventListener('click', async (e) => {
  const action = e.target.dataset.action;
  if (!action) return;

  if (action === 'pick') picker.click();
  if (action === 'reset') {
    await clear();
    applyBackground(null);
  }
  closeSheet();
});

picker.addEventListener('change', async () => {
  const [file] = picker.files;
  if (!file) return;

  await save(file);
  applyBackground(file);
  picker.value = '';
});

// Long press
let hold = null;
let start = null;

document.addEventListener('pointerdown', (e) => {
  if (sheet.contains(e.target)) return;
  start = { x: e.clientX, y: e.clientY };
  hold = setTimeout(openSheet, HOLD_MS);
});

document.addEventListener('pointermove', (e) => {
  if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10) clearTimeout(hold);
});

for (const type of ['pointerup', 'pointercancel']) {
  document.addEventListener(type, () => clearTimeout(hold));
}
