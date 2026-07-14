import test from 'node:test';
import assert from 'node:assert/strict';

import { encryptAndStore, decryptAndRetrieve, setEncryptionPassword } from '../public/assets/js/encryption-client.js';

class MemoryStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }
  setItem(key, value) {
    this.store.set(key, String(value));
  }
  removeItem(key) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

globalThis.localStorage = new MemoryStorage();
globalThis.sessionStorage = new MemoryStorage();

test('setEncryptionPassword allows changing the password and encrypt/decrypt round trips', async () => {
  setEncryptionPassword('strong-passphrase-123');
  const ok = await encryptAndStore('profile', { name: 'Ada' });
  assert.equal(ok, true);

  const value = await decryptAndRetrieve('profile');
  assert.deepEqual(value, { name: 'Ada' });
});
