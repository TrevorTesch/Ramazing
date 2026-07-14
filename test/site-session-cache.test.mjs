import test from 'node:test';
import assert from 'node:assert/strict';

import { saveSiteSessionData, getSiteSessionData, clearSiteSessionData } from '../public/assets/js/site-session-cache.js';

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

test('site session data can be stored and cleared for a specific origin', () => {
  saveSiteSessionData('https://example.com', { token: 'abc123' });
  const saved = getSiteSessionData('https://example.com');
  assert.equal(saved.token, 'abc123');
  assert.equal(typeof saved.updatedAt, 'number');

  clearSiteSessionData();
  assert.equal(getSiteSessionData('https://example.com'), null);
});
