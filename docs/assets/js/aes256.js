const runtimeCrypto = globalThis.crypto;
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const DERIVATION_ITERATIONS = 600_000;
const VERSION = 'v2';
const MIN_PASSPHRASE_LENGTH = 12;

function validatePassphrase(password) {
  if (typeof password !== 'string' || password.length < MIN_PASSPHRASE_LENGTH) {
    throw new Error(`Passphrase must be at least ${MIN_PASSPHRASE_LENGTH} characters long.`);
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
  validatePassphrase(password);

  const passwordKey = await runtimeCrypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return runtimeCrypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: DERIVATION_ITERATIONS,
      hash: 'SHA-256'
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptWithAes256(plainText, password) {
  if (typeof plainText !== 'string') {
    throw new Error('Input must be a string.');
  }
  validatePassphrase(password);

  const salt = runtimeCrypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = runtimeCrypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await deriveKey(password, salt);
  const encoded = encoder.encode(plainText);
  const encrypted = await runtimeCrypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);

  const payload = new Uint8Array(
    VERSION.length + 1 + SALT_LENGTH + IV_LENGTH + encrypted.byteLength
  );
  const header = encoder.encode(`${VERSION}:`);
  payload.set(header, 0);
  payload.set(salt, header.byteLength);
  payload.set(iv, header.byteLength + salt.byteLength);
  payload.set(new Uint8Array(encrypted), header.byteLength + salt.byteLength + iv.byteLength);

  return toBase64(payload);
}

export async function decryptWithAes256(payload, password) {
  if (typeof payload !== 'string' || payload.length === 0) {
    throw new Error('Payload must be a non-empty string.');
  }
  validatePassphrase(password);

  const packed = fromBase64(payload);
  const header = decoder.decode(packed.subarray(0, 3));
  if (header !== `${VERSION}:`) {
    throw new Error('Unsupported payload version.');
  }

  const saltStart = 3;
  const salt = packed.subarray(saltStart, saltStart + SALT_LENGTH);
  const ivStart = saltStart + SALT_LENGTH;
  const iv = packed.subarray(ivStart, ivStart + IV_LENGTH);
  const encrypted = packed.subarray(ivStart + IV_LENGTH);
  const key = await deriveKey(password, salt);
  try {
    const decrypted = await runtimeCrypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted);
    return decoder.decode(decrypted);
  } catch (error) {
    throw new Error('Authentication failed: payload could not be decrypted.');
  }
}
