// localStorage-backed persistence helpers.
// Kept async to match the original window.storage.get/set API shape
// so the component doesn't need to change at all.

export async function load(key, fallback) {
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : fallback;
  } catch {
    return fallback;
  }
}

export async function save(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e) {
    console.error("save failed", e);
  }
}
