import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const serviceWorker = readFileSync('sw.js', 'utf8');

test('service worker never app-shell caches API, cross-origin, or authenticated requests', () => {
  assert.match(serviceWorker, /url\.origin\s*!==\s*self\.location\.origin/);
  assert.match(serviceWorker, /url\.pathname\.startsWith\('\/api\/'\)/);
  assert.match(serviceWorker, /event\.request\.headers\.has\('authorization'\)/);
  assert.match(serviceWorker, /if \(event\.request\.method !== 'GET'.*isPersonalApi.*hasAuthorization\) return;/s);
});
