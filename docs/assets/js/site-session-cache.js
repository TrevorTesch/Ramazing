const STORAGE_KEY = 'ramazing-site-session-cache';

function normalizeOrigin(origin) {
  try {
    const url = new URL(origin);
    return url.origin;
  } catch {
    return origin;
  }
}

function readStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function saveSiteSessionData(origin, data) {
  const normalizedOrigin = normalizeOrigin(origin);
  const store = readStore();
  store[normalizedOrigin] = {
    ...data,
    updatedAt: Date.now()
  };
  writeStore(store);
  return store[normalizedOrigin];
}

export function getSiteSessionData(origin) {
  const normalizedOrigin = normalizeOrigin(origin);
  const store = readStore();
  return store[normalizedOrigin] || null;
}

export function clearSiteSessionData(origin = null) {
  const store = readStore();
  if (!origin) {
    localStorage.removeItem(STORAGE_KEY);
    return true;
  }

  const normalizedOrigin = normalizeOrigin(origin);
  delete store[normalizedOrigin];
  writeStore(store);
  return true;
}

function clearCookies() {
  if (typeof document === 'undefined') {
    return;
  }

  const cookies = document.cookie.split(';');
  cookies.forEach((cookie) => {
    const name = cookie.split('=')[0].trim();
    if (!name) return;

    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/;`;
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${location.hostname};`;
  });
}

export async function clearAllSiteSessionData(origin = null) {
  clearSiteSessionData(origin);
  clearCookies();

  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem('enc_pwd');
  }

  if (typeof window !== 'undefined' && 'caches' in window) {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
  }

  return true;
}
