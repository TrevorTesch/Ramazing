const DNS_RECORDS_URL = "/dns-records.json";
const DNS_OVERRIDE_KEY = "shadow-dns-overrides";
let dnsCache = null;

function normalizeDomain(input) {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split(/[/?#]/)[0];
}

export async function loadDnsRecords() {
  if (dnsCache) return dnsCache;
  try {
    const res = await fetch(DNS_RECORDS_URL);
    if (!res.ok) throw new Error("Could not load DNS records");
    dnsCache = await res.json();
  } catch (error) {
    console.warn("DNS records failed to load:", error);
    dnsCache = {};
  }
  const overrides = loadDnsOverrides();
  return { ...dnsCache, ...overrides };
}

export function loadDnsOverrides() {
  try {
    const raw = localStorage.getItem(DNS_OVERRIDE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (error) {
    console.warn("Invalid DNS override data", error);
    return {};
  }
}

export function saveDnsOverrides(records = {}) {
  try {
    localStorage.setItem(DNS_OVERRIDE_KEY, JSON.stringify(records));
    dnsCache = null;
    return true;
  } catch (error) {
    console.error("Failed to save DNS overrides", error);
    return false;
  }
}

export async function resolveUrl(input) {
  if (!input || typeof input !== "string") return input;
  const trimmed = input.trim();
  if (!trimmed) return trimmed;

  // preserve existing routed values
  if (/^(shadow:\/\/|\/uv\/service|https?:\/\/|wss?:\/\/)/i.test(trimmed)) {
    return trimmed;
  }

  const records = await loadDnsRecords();
  const domain = normalizeDomain(trimmed);

  if (records[domain]) {
    const mapped = records[domain];
    return mapped.startsWith("http") ? mapped : `https://${mapped}`;
  }

  if (trimmed.includes(".")) {
    return trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
  }

  return trimmed;
}

export function parseDnsLines(text = "") {
  const lines = text.split(/\r?\n/);
  const results = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const [key, ...rest] = trimmed.split("=");
    if (!key || rest.length === 0) continue;
    const value = rest.join("=").trim();
    if (key && value) {
      results[key.trim().toLowerCase()] = value;
    }
  }
  return results;
}

export function formatDnsLines(records = {}) {
  return Object.entries(records)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
}
