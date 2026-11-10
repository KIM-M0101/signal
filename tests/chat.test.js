import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createSignalServer } from '../server/chat.js';
import { compareBaze } from '../scripts/compare-baze.js';
import {
  CONTEXT_CHARS, DEFAULT_CHARACTERS, archiveRecords, conversationContext, emptyState, newMessage,
  prepareTestSignal, readState, receiveTestSignal, revealTestSignal, testSignalLetter, unreadCount, welcomeMessage,
} from '../src/model.js';

async function runServer(t, modelFetch, options = {}) {
  const server = createSignalServer({ modelFetch, ...options });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}

function post(base, body, headers = {}, path = '/api/chat') {
  return fetch(`${base}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
}

const user = content => ({ role: 'user', content });
const assistant = content => ({ role: 'assistant', content });
const character = { ...DEFAULT_CHARACTERS[1], personality: '짧고 차분하게 답해요.', photo: 'private-image' };

test('a test signal uses today’s completed chat, excluding greetings, safety replies and unanswered messages', () => {
  const [first, second] = DEFAULT_CHARACTERS;
  const today = new Date(2026, 10, 11, 12);
  const yesterday = new Date(2026, 10, 10, 12);
  const date = '2026-11-11';
  const story = newMessage('user', '오늘은 책을 두 쪽 읽었어.', undefined, today);
  const reply = newMessage('assistant', '두 쪽이라도 펴서 읽은 게 좋다.', 'ai', today);
  const later = new Date(2026, 10, 11, 15);
  const extra = newMessage('user', '읽은 구절을 노트에 옮겼어.', undefined, later);
  const extraReply = newMessage('assistant', '어떤 구절이 기억에 남았어?', 'ai', later);
  const state = { ...emptyState(), characters: DEFAULT_CHARACTERS, threads: {
    [first.id]: [welcomeMessage(first, today), story],
    [second.id]: [newMessage('user', '어제는 산책했어.', undefined, yesterday),
      newMessage('assistant', '산책 다녀왔구나.', 'ai', yesterday),
      newMessage('user', '오늘은 도움이 필요해.', undefined, today),
      newMessage('assistant', '가까운 사람에게 도움을 요청해 주세요.', 'safety', today)],
  } };
  assert.equal(prepareTestSignal(state, date), null);
  state.threads[first.id].push(reply, extra, extraReply, newMessage('user', '아직 답장을 못 받은 말.', undefined, later));
  const prepared = prepareTestSignal(state, date);
  assert.equal(prepared.sender, first);
  assert.deepEqual(prepared.messages, [user(story.text), assistant(reply.text), user(extra.text), assistant(extraReply.text)]);
  const message = '책을 펴고 마음에 남은 구절을 옮겨 적은 시간이 소중했겠다. 오늘은 편히 쉬어.';
  const arrived = receiveTestSignal(state, prepared.signal, message);
  assert.deepEqual(arrived.signals[0].candidateIds, [first.id]);
  assert.equal(revealTestSignal(arrived, date, first.id), arrived);
  const opened = revealTestSignal(arrived, date);
  assert.equal(opened.signals[0].opened, true);
  assert.deepEqual(testSignalLetter(opened, opened.signals[0]), { sender: first, message });
});

test('a two-character test signal keeps the first delivery and guess when reloaded', () => {
  const [first, second] = DEFAULT_CHARACTERS;
  const date = '2026-11-11';
  const now = new Date(2026, 10, 11, 12);
  const threads = Object.fromEntries(DEFAULT_CHARACTERS.map(({ id }) => [id, [
    newMessage('user', '오늘 발표를 마쳤어.', undefined, now),
    newMessage('assistant', '마지막까지 해냈구나.', 'ai', now),
  ]]));
  const { signals: initialSignals, ...legacy } = { ...emptyState(), characters: DEFAULT_CHARACTERS, threads };
  const migrated = readState(JSON.stringify(legacy));
  assert.deepEqual(migrated.signals, initialSignals);
  const { signal } = prepareTestSignal(migrated, date, () => 0);
  const legacySignal = { ...signal, storyId: threads[first.id][0].id, replyId: threads[first.id][1].id };
  const withLegacyLetter = readState(JSON.stringify({ ...migrated, signals: [legacySignal] }));
  assert.deepEqual(withLegacyLetter.signals, [legacySignal]);
  assert.ok(prepareTestSignal(withLegacyLetter, date));
  const message = '오늘 발표를 마친 너한테 편안한 밤이었으면 좋겠다.';
  const arrived = receiveTestSignal(withLegacyLetter, signal, message);
  assert.deepEqual(arrived.signals[0].candidateIds, [first.id, second.id]);
  assert.equal(arrived.signals.length, 1);
  assert.equal(prepareTestSignal(arrived, date, () => 0.9), null);
  assert.equal(receiveTestSignal(arrived, signal, '다른 메시지'), arrived);
  assert.equal(revealTestSignal(arrived, date), arrived);
  const opened = revealTestSignal(arrived, date, second.id);
  assert.equal(revealTestSignal(opened, date, first.id), opened);
  const reloaded = readState(JSON.stringify(opened));
  assert.deepEqual(reloaded.signals, opened.signals);
  assert.equal(reloaded.signals[0].senderId, first.id);
  assert.equal(reloaded.signals[0].guessId, second.id);
  assert.equal(reloaded.signals[0].message, message);
});

test('signal uses the selected voice and day transcript for a new message and gates Baze calls', async t => {
  const transcript = [user('오늘 공책에 다섯 줄 적었어요.'), assistant('공책에 적으셨군요.')];
  const dayEnd = '공책에 다섯 줄을 채우는 데 들인 마음이 느껴져요. 오늘 밤은 조금 편하게 쉬어요.';
  const requests = [];
  const base = await runServer(t, async (_url, options) => {
    requests.push(JSON.parse(options.body));
    const content = requests.length === 1 ? dayEnd : transcript.at(-1).content;
    return Response.json({ choices: [{ message: { content } }] });
  }, { provider: 'baze', apiKey: 'fixture-key' });
  const signalPost = (body, headers = {}) => post(base, body, headers, '/api/signal');
  const body = { character, messages: transcript };
  assert.equal((await signalPost(body)).status, 403);
  assert.equal((await signalPost({ ...body, bazeConsent: true }, { origin: 'https://other.invalid' })).status, 403);
  assert.equal((await signalPost({ ...body, bazeConsent: true, messages: [user('자해할 것 같아'), transcript[1]] })).status, 422);
  assert.equal(requests.length, 0);
  const response = await signalPost({ ...body, bazeConsent: true });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { reply: dayEnd, source: 'ai' });
  assert.equal(requests[0].model, 'gpt-6-luna');
  assert.match(requests[0].messages[0].content, /end-of-day message/);
  assert.match(requests[0].messages[0].content, /polite Korean 해요체/);
  assert.doesNotMatch(JSON.stringify(requests[0]), /private-image/);
  assert.deepEqual(JSON.parse(requests[0].messages[1].content), transcript);
  assert.equal((await signalPost({ ...body, bazeConsent: true })).status, 503);
});

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

test('Baze comparison sends the same synthetic cases to both models and estimates credits separately', async () => {
  const requests = [];
  const results = await compareBaze({
    apiKey: 'fixture-key',
    fetchModel: async (url, options) => {
      assert.equal(url, 'https://api.baze.co/v1/gateway/chat/completions/');
      assert.equal(options.headers.authorization, 'Bearer fixture-key');
      assert.equal(options.redirect, 'error');
      requests.push(JSON.parse(options.body));
      return Response.json({
        choices: [{ message: { content: '수학 문제 두 개 풀었네.' } }],
        usage: { prompt_tokens: 800, completion_tokens: 100 },
      });
    },
  });
  assert.equal(results.length, 12);
  for (let index = 0; index < requests.length; index += 2) {
    assert.deepEqual(requests[index].messages, requests[index + 1].messages);
    assert.equal(requests[index].max_tokens, 256);
  }
  assert.match(requests[0].messages[0].content, /지우야/);
  assert.match(requests[2].messages[0].content, /polite Korean 해요체/);
  assert.equal(results[0].estimatedCredits, 0.13);
  assert.equal(results[1].estimatedCredits, 0.12);
  assert.equal(results[0].reply, '수학 문제 두 개 풀었네.');
});

test('Baze comparison stops on an API error and keeps provider response details private', async () => {
  let calls = 0;
  await assert.rejects(compareBaze({
    apiKey: 'fixture-key',
    fetchModel: async () => {
      calls += 1;
      return Response.json({ error: 'private upstream details' }, { status: 429 });
    },
  }), error => error.message.includes('429') && !error.message.includes('private upstream details'));
  assert.equal(calls, 1);
});

test('the Baze preview requires a loopback server and a key', () => {
  assert.throws(() => createSignalServer({ provider: 'baze' }), /API 키/);
  assert.throws(() => createSignalServer({ provider: 'baze', host: '0.0.0.0', apiKey: 'fixture-key' }), /이 PC/);
});

test('the Baze preview gates external calls and returns Luna token usage without private data', async t => {
  const calls = [];
  const base = await runServer(t, async (url, options) => {
    calls.push({ url, authorization: options.headers.authorization, request: JSON.parse(options.body) });
    return Response.json({
      choices: [{ message: { content: '산책하느라 수고했어요.' } }],
      usage: { prompt_tokens: 231, completion_tokens: 26 },
    });
  }, { provider: 'baze', apiKey: 'fixture-key' });
  const status = await fetch(base + '/api/chat/status');
  assert.deepEqual(await status.json(), { available: true, provider: 'baze', model: 'gpt-6-luna' });
  const draft = { character, messages: [user('산책했어요.')] };
  assert.equal((await post(base, draft)).status, 403);
  const risk = user('자해할 것 같아');
  const safe = await post(base, { ...draft, messages: [risk], bazeConsent: true });
  assert.equal((await safe.json()).source, 'safety');
  assert.equal(calls.length, 0);
  const response = await post(base, {
    ...draft, messages: [risk, assistant('로컬 안전 안내'), ...draft.messages], bazeConsent: true,
  });
  assert.deepEqual(await response.json(), { reply: '산책하느라 수고했어요.', source: 'ai', usage: { input: 231, output: 26 } });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.baze.co/v1/gateway/chat/completions/');
  assert.equal(calls[0].authorization, 'Bearer fixture-key');
  assert.equal(calls[0].request.model, 'gpt-6-luna');
  assert.equal(calls[0].request.max_tokens, 256);
  assert.deepEqual(calls[0].request.messages.slice(1), draft.messages);
  assert.doesNotMatch(JSON.stringify(calls[0].request), /private-image|자해|fixture-key/);
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
