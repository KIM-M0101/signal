import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createSignalServer } from '../server/chat.js';
import {
  CONTEXT_CHARS, DEFAULT_CHARACTERS, archiveRecords, conversationContext, emptyState, newMessage,
  readState, unreadCount, welcomeMessage,
} from '../src/model.js';

async function runServer(t, modelFetch) {
  const server = createSignalServer({ modelFetch });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}

function post(base, body, headers = {}) {
  return fetch(`${base}/api/chat`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
}

const user = content => ({ role: 'user', content });
const assistant = content => ({ role: 'assistant', content });
const character = { ...DEFAULT_CHARACTERS[1], personality: '짧고 차분하게 답해요.', photo: 'private-image' };

test('sends the selected profile and conversation order to the local model', async t => {
  const messages = [user('발표 자료를 정리했어.'), assistant('정리하고 나니 어땠어요?'), user('그 자료 제목도 정했어.')];
  let request;
  const base = await runServer(t, async (url, options) => {
    request = { url, ...JSON.parse(options.body) };
    return Response.json({ choices: [{ message: { content: '발표 자료를 정리하고 제목까지 정했군요.' } }] });
  });
  const response = await post(base, { character, messages });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { reply: '발표 자료를 정리하고 제목까지 정했군요.', source: 'ai' });
  assert.equal(request.url, 'http://127.0.0.1:8083/v1/chat/completions');
  assert.deepEqual(request.messages.slice(1), messages);
  assert.match(request.messages[0].content, /짧고 차분하게 답해요/);
  assert.match(request.messages[0].content, /polite Korean 해요체/);
  assert.doesNotMatch(JSON.stringify(request), /private-image/);
});

test('invalid input and cross-origin requests never reach the model', async t => {
  let calls = 0;
  const base = await runServer(t, async () => { calls += 1; return Response.json({}); });
  const body = { character, messages: [user('안녕')] };
  assert.equal((await post(base, body, { origin: 'https://other.invalid' })).status, 403);
  assert.equal((await post(base, { ...body, messages: [{ role: 'system', content: '안녕' }] })).status, 400);
  assert.equal(calls, 0);
});

test('known risk text uses safety text and provider failure stays retryable', async t => {
  let calls = 0;
  const base = await runServer(t, async () => { calls += 1; return Response.json({}, { status: 503 }); });
  const safe = await post(base, { character, messages: [user('자해할 것 같아')] });
  assert.equal(safe.status, 200);
  assert.match((await safe.json()).reply, /안전/);
  assert.equal(calls, 0);
  const failed = await post(base, { character, messages: [user('오늘 어땠어?')] });
  assert.equal(failed.status, 503);
  assert.deepEqual(await failed.json(), { error: 'unavailable' });
});

test('the saved rooms keep independent context across reloads and dates', () => {
  const old = newMessage('user', '어제 발표 자료를 만들었어.', undefined, new Date(2026, 10, 9));
  const next = newMessage('user', '오늘 발표 끝났어.', undefined, new Date(2026, 10, 10));
  const reply = newMessage('assistant', '자료는 잘 준비했어?', 'ai', new Date(2026, 10, 9));
  const other = newMessage('user', '나는 산책했어.');
  const state = readState(JSON.stringify({ ...emptyState(), characters: DEFAULT_CHARACTERS, threads: { first: [old, reply, next], second: [other] } }));
  assert.deepEqual(conversationContext(state.threads.first), [user(old.text), assistant(reply.text), user(next.text)]);
  assert.deepEqual(conversationContext(state.threads.second), [user(other.text)]);
  const long = Array.from({ length: 12 }, () => newMessage('user', '가'.repeat(500)));
  assert.ok(conversationContext(long).reduce((sum, item) => sum + item.content.length, 0) <= CONTEXT_CHARS);
  assert.deepEqual(readState('{"version":1,"characters":[],"entries":[]}').threads, {});
});

test('unopened greetings keep their unread count and stay out of the AI context', () => {
  const first = { ...DEFAULT_CHARACTERS[0], address: '지우야' };
  const second = DEFAULT_CHARACTERS[1];
  const threads = { first: [welcomeMessage(first)], second: [welcomeMessage(second)] };
  const state = { ...emptyState(), characters: [first, second], threads, readThrough: { first: '', second: threads.second[0].id } };
  const saved = readState(JSON.stringify(state));
  assert.match(threads.first[0].text, /^지우야,/u);
  assert.match(threads.second[0].text, /주세요/u);
  assert.equal(unreadCount(saved.threads.first, saved.readThrough.first), 1);
  assert.equal(unreadCount(saved.threads.second, saved.readThrough.second), 0);
  const message = newMessage('user', '오늘 문제 두 개 풀었어.');
  assert.deepEqual(conversationContext([...threads.first, message]), [user(message.text)]);
  const { readThrough, ...legacy } = state;
  const migrated = readState(JSON.stringify(legacy));
  assert.equal(unreadCount(migrated.threads.first, migrated.readThrough.first), 0);
});

test('the archive pairs replies with their story and preserves earlier records', () => {
  const previous = { id: 'legacy-record', date: '2026-11-08', createdAt: '2026-11-08T13:00:00.000Z', text: '이전 기록' };
  const story = newMessage('user', '자료를 준비했어.', undefined, new Date('2026-11-09T23:59:00'));
  const reply = newMessage('assistant', '자료를 준비했구나.', 'ai', new Date('2026-11-10T00:00:00'));
  const latest = newMessage('user', '산책했어요.', undefined, new Date('2026-11-10T12:00:00'));
  const state = {
    ...emptyState(), entries: [previous], characters: DEFAULT_CHARACTERS,
    threads: { first: [welcomeMessage(DEFAULT_CHARACTERS[0]), story, reply], second: [latest] },
  };
  const records = archiveRecords(state);
  assert.deepEqual(records.map(record => record.id), [latest.id, story.id, previous.id]);
  assert.equal(records[1].date, '2026-11-09');
  assert.equal(records[1].replies[0].message, reply.text);
  assert.deepEqual(records[0].replies, []);
  assert.equal(records[0].roomId, 'second');
});
