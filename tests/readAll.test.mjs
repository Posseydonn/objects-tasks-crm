import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readAll } from '../src/lib/readAll.ts';

test('loads beyond API cap without losing order or records', async () => {
  const source = Array.from({ length: 1251 }, (_, id) => ({ id }));
  let calls = 0;
  const rows = await readAll((from, to) => {
    calls++;
    return Promise.resolve({ data: source.slice(from, Math.min(to + 1, from + 137)), error: null });
  });
  assert.deepEqual(rows, source);
  assert.equal(calls, 11);
});

test('a failed later page rejects rather than showing a partial list', async () => {
  await assert.rejects(readAll(from => Promise.resolve(from === 0
    ? { data: [{ id: 1 }], error: null }
    : { data: null, error: new Error('aborted') })), /aborted/);
});
