// Tiny vitest-`expect`-compatible shim over node:assert/strict, so the test files can run with
// zero assertion-library dependencies with compiled tests run on Node `node:test` (no vitest/jest in this local stand-in).
import assert from 'node:assert/strict';

function deepIncludes(haystack: unknown, needle: unknown): boolean {
  if (Array.isArray(haystack)) return haystack.some((h) => deepEqualSafe(h, needle));
  if (typeof haystack === 'string') return haystack.includes(String(needle));
  return false;
}
function deepEqualSafe(a: unknown, b: unknown): boolean {
  try { assert.deepStrictEqual(a, b); return true; } catch { return false; }
}

export function expect(actual: any) {
  const api = {
    toBe(expected: any) { assert.strictEqual(actual, expected); },
    toEqual(expected: any) { assert.deepStrictEqual(actual, expected); },
    toBeNull() { assert.strictEqual(actual, null); },
    toBeUndefined() { assert.strictEqual(actual, undefined); },
    toBeTruthy() { assert.ok(actual, `expected ${JSON.stringify(actual)} to be truthy`); },
    toContain(expected: any) { assert.ok(deepIncludes(actual, expected), `expected ${JSON.stringify(actual)} to contain ${JSON.stringify(expected)}`); },
    toMatchObject(expected: Record<string, any>) {
      for (const key of Object.keys(expected)) {
        assert.deepStrictEqual(actual[key], expected[key], `mismatch on key "${key}"`);
      }
    },
    get not() {
      return {
        toBe(expected: any) { assert.notStrictEqual(actual, expected); },
        toContain(expected: any) { assert.ok(!deepIncludes(actual, expected), `expected ${JSON.stringify(actual)} not to contain ${JSON.stringify(expected)}`); }
      };
    }
  };
  return api;
}
