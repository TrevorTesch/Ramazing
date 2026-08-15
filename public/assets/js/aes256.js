const runtimeCrypto = globalThis.crypto;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

const SALT_LENGTH = 16; // bytes
const IV_LENGTH = 12;   // bytes (recommended for GCM)
const DERIVATION_ITERATIONS = 600_000;

const VERSION = 'v2';
const MIN_PASSPHRASE_LENGTH = 12;

// Keep payload format compatible with your existing implementation:
// VERSION + ':' (3 bytes for 'v2:') + salt(16) + iv(12) + ciphertext
const HEADER_BYTES = encoder.encode(`${VERSION}:`);
const MIN_PAYLOAD_BYTES = HEADER_BYTES.length + SALT_LENGTH + IV_LENGTH + 1;

function validatePassphrase(password) {
  if (typeof password !== 'string' || password.length < MIN_PASSPHRASE_LENGTH) {
    throw new Error(`Passphrase must be at least ${MIN_PASSPHRASE_LENGTH} characters long.`);
  }
}

function toBase64(bytes) {
  if (typeof globalThis.Buffer !== 'undefined') {
    return globalThis.Buffer.from(bytes).toString('base64');
  }

  // Convert bytes -> binary string safely
  const binString = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
  return btoa(binString);
}

function fromBase64(value) {
  if (typeof globalThis.Buffer !== 'undefined') {
    return Uint8Array.from(globalThis.Buffer.from(value, 'base64'));
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

  // AES-GCM encryption returns ciphertext+authTag (WebCrypto behavior)
  const encryptedBuffer = await runtimeCrypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  );

  const encrypted = new Uint8Array(encryptedBuffer);

  // Build payload: header + salt + iv + ciphertext
  const payload = new Uint8Array(
    HEADER_BYTES.length + SALT_LENGTH + IV_LENGTH + encrypted.byteLength
  );

  payload.set(HEADER_BYTES, 0);
  payload.set(salt, HEADER_BYTES.length);
  payload.set(iv, HEADER_BYTES.length + SALT_LENGTH);
  payload.set(encrypted, HEADER_BYTES.length + SALT_LENGTH + IV_LENGTH);

  return toBase64(payload);
}

function constantTimeHeaderEquals(packed, offsetBytes, headerBytes) {
  if (packed.length < offsetBytes + headerBytes.length) return false;
  let ok = 0;
  for (let i = 0; i < headerBytes.length; i += 1) {
    ok |= packed[offsetBytes + i] ^ headerBytes[i];
  }
  return ok === 0;
}

export async function decryptWithAes256(payload, password) {
  if (typeof payload !== 'string' || payload.length === 0) {
    throw new Error('Payload must be a non-empty string.');
  }
  validatePassphrase(password);

  const packed = fromBase64(payload);

  if (packed.length < MIN_PAYLOAD_BYTES) {
    throw new Error('Unsupported payload format (too short).');
  }

  // Validate header bytes (compatible with your v2 format)
  if (!constantTimeHeaderEquals(packed, 0, HEADER_BYTES)) {
    throw new Error('Unsupported payload version.');
  }

  const saltStart = HEADER_BYTES.length;
  const salt = packed.subarray(saltStart, saltStart + SALT_LENGTH);

  const ivStart = saltStart + SALT_LENGTH;
  const iv = packed.subarray(ivStart, ivStart + IV_LENGTH);

  const encrypted = packed.subarray(ivStart + IV_LENGTH);

  const key = await deriveKey(password, salt);

  try {
    const decrypted = await runtimeCrypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encrypted
    );
    return decoder.decode(decrypted);
  } catch (error) {
    throw new Error('Authentication failed: payload could not be decrypted.');
  }
}
