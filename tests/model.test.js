import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CHARACTERS, cleanCharacter, emptyState, makeEntry, readState } from '../src/model.js';

const story = '미뤄둔 과제를 10분 시작했어.';

test('a record gets two different replies grounded in the same story', async () => {
  const entry = await makeEntry(story, DEFAULT_CHARACTERS);
  assert.equal(entry.status, 'prepared');
  assert.equal(entry.replies.length, 2);
  assert.notEqual(entry.replies[0].message, entry.replies[1].message);
  for (const reply of entry.replies) assert.ok(reply.message.includes(story));
  assert.match(entry.replies[1].message, /만해요/);
});

test('a delayed provider is cancelled and replaced with two prepared replies', async () => {
  let pending;
  const entry = await makeEntry(story, DEFAULT_CHARACTERS, {
    timeoutMs: 15,
    generate({ signal }) { pending = signal; return new Promise(() => {}); },
  });
  assert.equal(pending.aborted, true);
  assert.equal(entry.status, 'fallback');
  assert.equal(entry.replies.length, 2);
});

test('invalid generated output is replaced as a pair', async () => {
  const entry = await makeEntry(story, DEFAULT_CHARACTERS, { generate: async () => ['응원해', '나만 믿어'] });
  assert.equal(entry.status, 'fallback');
  assert.ok(entry.replies.every(reply => reply.message.includes(story)));
});

test('risk and difficult feelings use local support instead of the generator', async () => {
  let calls = 0;
  const generate = async () => { calls += 1; return ['잘했어', '잘했어요']; };
  const safety = await makeEntry('죽고 싶다는 생각이 들어.', DEFAULT_CHARACTERS, { generate });
  const support = await makeEntry('오늘은 너무 불안하고 힘들었어.', DEFAULT_CHARACTERS, { generate });
  assert.equal(calls, 0);
  assert.equal(safety.status, 'safety');
  assert.ok(safety.replies.every(reply => reply.message.includes('안전') && !reply.message.includes('잘했')));
  assert.equal(support.status, 'support');
});

test('saved replies keep their author and day when characters are edited', async () => {
  const entry = await makeEntry(story, DEFAULT_CHARACTERS, { now: new Date(2026, 10, 10, 19, 20) });
  const characters = DEFAULT_CHARACTERS.map(character => ({ ...character, name: '가상 캐릭터' }));
  const restored = readState(JSON.stringify({ ...emptyState(), characters, entries: [entry] }));
  assert.equal(restored.entries[0].date, '2026-11-10');
  assert.equal(restored.entries[0].replies[0].name, DEFAULT_CHARACTERS[0].name);
  assert.equal(restored.characters[0].name, '가상 캐릭터');
  assert.equal(cleanCharacter({ ...characters[0], photo: 'https://example.test/photo.png' }, 'first').photo, '');
});
