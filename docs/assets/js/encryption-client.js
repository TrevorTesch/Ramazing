/**
 * Client-side encryption for sensitive data.
 * Uses the Web Crypto API with AES-GCM and PBKDF2 for stronger browser-side protection.
 */

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const ITERATIONS = 250_000;
const VERSION = 'v2';
let encryptionPassword = 'shadow-browser-local-encryption';

function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 12) {
    throw new Error('Password must be at least 12 characters long.');
  }
}

function toBase64(bytes) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  const length = bytes.byteLength;
  for (let i = 0; i < length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(value) {
  if (typeof Buffer !== 'undefined') {
    return Uint8Array.from(Buffer.from(value, 'base64'));
  }
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveKey(password, salt) {
  validatePassword(password);
  const passwordKey = await crypto.subtle.importKey('raw', encoder.encode(password), { name: 'PBKDF2' }, false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: ITERATIONS,
      hash: 'SHA-256'
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt and store data in localStorage.
 * @param {string} key - Storage key
 * @param {object} data - Data to encrypt and store
 */
export async function encryptAndStore(key, data) {
  try {
    if (typeof key !== 'string' || !key) {
      throw new Error('Storage key must be a non-empty string.');
    }

    const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const keyMaterial = await deriveKey(encryptionPassword, salt);
    const encoded = encoder.encode(JSON.stringify(data));
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, keyMaterial, encoded);

    const payload = new Uint8Array(VERSION.length + 1 + SALT_LENGTH + IV_LENGTH + encrypted.byteLength);
    const header = encoder.encode(`${VERSION}:`);
    payload.set(header, 0);
    payload.set(salt, header.byteLength);
    payload.set(iv, header.byteLength + salt.byteLength);
    payload.set(new Uint8Array(encrypted), header.byteLength + salt.byteLength + iv.byteLength);

    localStorage.setItem(key, toBase64(payload));
    return true;
  } catch (error) {
    console.error('Encryption failed:', error);
    return false;
  }
}

/**
 * Retrieve and decrypt data from localStorage.
 * @param {string} key - Storage key
 * @returns {object|null} - Decrypted data or null if fails
 */
export async function decryptAndRetrieve(key) {
  try {
    const encrypted = localStorage.getItem(key);
    if (!encrypted) return null;

    const packed = fromBase64(encrypted);
    const header = decoder.decode(packed.subarray(0, 3));
    if (header !== `${VERSION}:`) {
      throw new Error('Unsupported payload format.');
    }

    const saltStart = 3;
    const salt = packed.subarray(saltStart, saltStart + SALT_LENGTH);
    const ivStart = saltStart + SALT_LENGTH;
    const iv = packed.subarray(ivStart, ivStart + IV_LENGTH);
    const cipherText = packed.subarray(ivStart + IV_LENGTH);
    const keyMaterial = await deriveKey(encryptionPassword, salt);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, keyMaterial, cipherText);
    return JSON.parse(decoder.decode(decrypted));
  } catch (error) {
    console.error('Decryption failed:', error);
    return null;
  }
}

/**
 * Set custom encryption password.
 * @param {string} password - New encryption password
 */
export function setEncryptionPassword(password) {
  validatePassword(password);
  encryptionPassword = password;
}

/**
 * Clear sensitive data from memory and storage.
 */
export function clearSensitiveData() {
  const sensitiveKeys = ['bookmarks', 'history', 'settings', 'tokens'];
  sensitiveKeys.forEach((key) => localStorage.removeItem(key));
}
