import dns from 'node:dns';
import { promisify } from 'node:util';

const resolve4 = promisify(dns.resolve4);
const resolve6 = promisify(dns.resolve6);

// IPv4 private ranges checks (simple numeric)
function ipv4ToInt(ip) {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;
}
function isPrivateIPv4(ip) {
  try {
    const i = ipv4ToInt(ip);
    // 10.0.0.0/8
    if ((i & 0xff000000) === 0x0a000000) return true;
    // 172.16.0.0/12
    if ((i & 0xfff00000) === 0xac100000) return true;
    // 192.168.0.0/16
    if ((i & 0xffff0000) === 0xc0a80000) return true;
    // 127.0.0.0/8
    if ((i & 0xff000000) === 0x7f000000) return true;
    return false;
  } catch {
    return true;
  }
}
function isPrivateIPv6(ip) {
  const lower = ip.toLowerCase();
  if (lower === '::1') return true;
  if (lower.startsWith('fe80:')) return true; // link-local
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // ULA
  return false;
}

async function resolveHost(host, timeoutMs = 3000) {
  const results = { v4: [], v6: [] };

  const p4 = resolve4(host).then(r => { results.v4 = results.v4.concat(r); }).catch(() => {});
  const p6 = resolve6(host).then(r => { results.v6 = results.v6.concat(r); }).catch(() => {});

  const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('DNS_TIMEOUT')), timeoutMs));
  await Promise.race([Promise.all([p4, p6]), timeout]);
  return results;
}

/**
 * Validate an upstream URL against an allowlist and internal IP blocks.
 * - allowedHosts: array of strings (exact hostnames or ".suffix" for domain suffix)
 * Throws an Error with code property for callers to return safe JSON errors.
 */
export async function validateUpstream(targetUrlString, allowedHosts = [], opts = {}) {
  let url;
  try {
    url = new URL(targetUrlString);
  } catch {
    const err = new Error('Invalid URL');
    err.code = 'INVALID_URL';
    throw err;
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    const err = new Error('Unsupported protocol');
    err.code = 'INVALID_PROTOCOL';
    throw err;
  }

  const hostname = url.hostname.toLowerCase();
  const allowed = allowedHosts.some(a => {
    const s = a.toLowerCase();
    if (!s) return false;
    if (s.startsWith('.')) return hostname.endsWith(s); // suffix match
    return hostname === s;
  });

  if (!allowed) {
    const err = new Error('Host not in allowlist');
    err.code = 'SSRF_NOT_ALLOWED';
    throw err;
  }

  // Resolve DNS and check IPs
  const { v4, v6 } = await resolveHost(hostname, opts.dnsTimeoutMs || 3000).catch((e) => {
    const err = new Error('DNS resolution failed');
    err.code = 'DNS_ERROR';
    throw err;
  });

  // If no results, block
  if ((v4.length === 0) && (v6.length === 0)) {
    const err = new Error('Could not resolve host');
    err.code = 'DNS_NO_RESULTS';
    throw err;
  }

  // Check each address isn't private
  for (const ip of v4) {
    if (isPrivateIPv4(ip)) {
      const err = new Error('Resolved to private IPv4');
      err.code = 'SSRF_BLOCKED_IP';
      throw err;
    }
  }
  for (const ip of v6) {
    if (isPrivateIPv6(ip)) {
      const err = new Error('Resolved to private IPv6');
      err.code = 'SSRF_BLOCKED_IP';
      throw err;
    }
  }

  return true;
}
