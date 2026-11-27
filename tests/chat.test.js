import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createSignalServer } from '../server/chat.js';
import { compareBaze } from '../scripts/compare-baze.js';
import { DEFAULT_CHARACTERS, DEFAULT_PROFILE, characterPrompt, userPrompt } from '../src/model.js';

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
const haon = { ...DEFAULT_CHARACTERS[1], name: '하온', address: '지우 님', preference: '힘들 땐 먼저 공감해 주세요.', photo: 'private-image' };
const yunseo = { ...DEFAULT_CHARACTERS[0], name: '윤서', address: '지우야', photo: 'private-image' };
const character = { ...characterPrompt(haon), photo: 'private-image' };
const profile = userPrompt({ ...DEFAULT_PROFILE, nickname: '지우', likes: '고양이', dislikes: '놀리는 말투' });
const diary = { emoji: '🙂', text: '미뤄둔 과제를 10분 시작했어.' };

test('chat sends the character voice, user profile and room order to the local model', async t => {
  const messages = [user('발표 자료를 정리했어.'), assistant('정리하고 나니 어땠어요?'), user('그 자료 제목도 정했어.')];
  let request;
  const base = await runServer(t, async (url, options) => {
    request = { url, ...JSON.parse(options.body) };
    return Response.json({ choices: [{ message: { content: '발표 자료를 정리하고 제목까지 정했군요.' } }] });
  });
  const response = await post(base, { character, user: profile, messages });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { reply: '발표 자료를 정리하고 제목까지 정했군요.', source: 'ai' });
  assert.equal(request.url, 'http://127.0.0.1:8083/v1/chat/completions');
  assert.deepEqual(request.messages.slice(1), messages);
  assert.match(request.messages[0].content, /힘들 땐 먼저 공감해 주세요/);
  assert.match(request.messages[0].content, /polite Korean 해요체/);
  assert.match(request.messages[0].content, /고양이/);
  assert.doesNotMatch(JSON.stringify(request), /private-image/);
});

test('반말 모드 switches the voice regardless of relation', async t => {
  let prompt;
  const base = await runServer(t, async (_url, options) => {
    prompt = JSON.parse(options.body).messages[0].content;
    return Response.json({ choices: [{ message: { content: '좋다!' } }] });
  });
  await post(base, { character: { ...character, casual: true }, user: profile, messages: [user('산책했어')] });
  assert.match(prompt, /casual Korean 반말/);
});

test('diary writes one comment and two separate character reactions', async t => {
  const prompts = [];
  const replies = ['과제를 10분 시작한 용기가 보여요. 오늘의 첫걸음을 응원해요.', '10분이라도 시작한 거 진짜 멋져!', '시작하신 10분이 오늘을 바꿨네요.'];
  const base = await runServer(t, async (_url, options) => {
    const body = JSON.parse(options.body);
    prompts.push(body.messages);
    return Response.json({ choices: [{ message: { content: replies[prompts.length - 1] } }] });
  });
  const response = await post(base, { characters: [characterPrompt(yunseo), characterPrompt(haon)], user: profile, diary }, {}, '/api/diary');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { comment: replies[0], reactions: [replies[1], replies[2]], source: 'ai' });
  assert.equal(prompts.length, 3);
  assert.match(prompts[0][0].content, /오늘의 한마디/);
  assert.match(prompts[0][0].content, /Do not invent/);
  assert.match(prompts[1][0].content, /casual Korean 반말/);
  assert.match(prompts[2][0].content, /polite Korean 해요체/);
  assert.deepEqual(JSON.parse(prompts[1][1].content), { mood: '🙂 괜찮아요', diary: diary.text });
});

test('diary without an emoji or with risk text never reaches the model', async t => {
  let calls = 0;
  const base = await runServer(t, async () => { calls += 1; return Response.json({}); });
  const characters = [characterPrompt(yunseo), characterPrompt(haon)];
  assert.equal((await post(base, { characters, user: profile, diary: { text: diary.text } }, {}, '/api/diary')).status, 400);
  assert.equal((await post(base, { characters, user: profile, diary: { emoji: '😣', text: '죽고 싶다' } }, {}, '/api/diary')).status, 422);
  assert.equal(calls, 0);
});

test('signal uses the diary and the sender’s chat for a new letter and gates Baze calls', async t => {
  const transcript = [user('오늘 공책에 다섯 줄 적었어요.'), assistant('공책에 적으셨군요.')];
  const dayEnd = '공책에 다섯 줄을 채우는 데 들인 마음이 느껴져요. 오늘 밤은 조금 편하게 쉬어요.';
  const requests = [];
  const base = await runServer(t, async (_url, options) => {
    requests.push(JSON.parse(options.body));
    const content = requests.length === 1 ? dayEnd : transcript.at(-1).content;
    return Response.json({ choices: [{ message: { content } }] });
  }, { provider: 'baze', apiKey: 'fixture-key' });
  const signalPost = (body, headers = {}) => post(base, body, headers, '/api/signal');
  const body = { character, user: profile, diary, messages: transcript };
  assert.equal((await signalPost(body)).status, 403);
  assert.equal((await signalPost({ ...body, bazeConsent: true }, { origin: 'https://other.invalid' })).status, 403);
  assert.equal((await signalPost({ ...body, bazeConsent: true, messages: [user('자해할 것 같아'), transcript[1]] })).status, 422);
  assert.equal(requests.length, 0);
  const response = await signalPost({ ...body, bazeConsent: true });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.reply, dayEnd);
  assert.equal(requests[0].model, 'gpt-6-luna');
  assert.match(requests[0].messages[0].content, /end-of-day letter/);
  assert.doesNotMatch(JSON.stringify(requests[0]), /private-image/);
  assert.deepEqual(JSON.parse(requests[0].messages[1].content).todayChat, transcript);
  assert.equal((await signalPost({ ...body, bazeConsent: true })).status, 503);
});

test('invalid input and cross-origin requests never reach the model', async t => {
  let calls = 0;
  const base = await runServer(t, async () => { calls += 1; return Response.json({}); });
  const body = { character, user: profile, messages: [user('안녕')] };
  assert.equal((await post(base, body, { origin: 'https://other.invalid' })).status, 403);
  assert.equal((await post(base, { ...body, messages: [{ role: 'system', content: '안녕' }] })).status, 400);
  assert.equal((await post(base, { ...body, character: { ...character, style: '장난스럽게' } })).status, 400);
  assert.equal(calls, 0);
});

test('known risk text uses safety text and provider failure stays retryable', async t => {
  let calls = 0;
  const base = await runServer(t, async () => { calls += 1; return Response.json({}, { status: 503 }); });
  const safe = await post(base, { character, user: profile, messages: [user('자해할 것 같아')] });
  assert.equal(safe.status, 200);
  assert.match((await safe.json()).reply, /안전/);
  assert.equal(calls, 0);
  const failed = await post(base, { character, user: profile, messages: [user('오늘 어땠어?')] });
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
  const draft = { character, user: profile, messages: [user('산책했어요.')] };
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


test('replies with Japanese, Chinese characters or the wrong speech level are rewritten', async t => {
  const outputs = ['今日は 정말 수고했어요.', '오늘 정말 수고했어. 푹 쉬어요.', '오늘 정말 수고했어. 푹 쉬어.'];
  const prompts = [];
  const base = await runServer(t, async (_url, options) => {
    const body = JSON.parse(options.body);
    prompts.push(body);
    return Response.json({ choices: [{ message: { content: outputs[prompts.length - 1] } }] });
  });
  const response = await post(base, { character: { ...character, casual: true }, user: profile, messages: [user('오늘 발표 끝났어')] });
  assert.deepEqual(await response.json(), { reply: '오늘 정말 수고했어. 푹 쉬어.', source: 'ai' });
  assert.equal(prompts.length, 3);
  assert.match(prompts[1].messages[0].content, /only Korean Hangul/);
  assert.match(prompts[2].messages[0].content, /use only 반말/);
  assert.equal(prompts[2].temperature, 0.3);
});

test('a reply that keeps foreign characters is cleaned, and a wrong voice is never shown', async t => {
  const base = await runServer(t, async () => Response.json({ choices: [{ message: { content: '오늘 발표 끝내느라 정말 수고했어요(辛苦了)!' } }] }));
  const cleaned = await post(base, { character, user: profile, messages: [user('발표 끝났어요')] });
  assert.deepEqual(await cleaned.json(), { reply: '오늘 발표 끝내느라 정말 수고했어요!', source: 'ai' });

  const wrong = await runServer(t, async () => Response.json({ choices: [{ message: { content: '오늘 진짜 수고했어. 푹 쉬어.' } }] }));
  assert.equal((await post(wrong, { character, user: profile, messages: [user('발표 끝났어요')] })).status, 503);
});

test('a signal for a day without a diary is written from that day’s chat only', async t => {
  let request;
  const base = await runServer(t, async (_url, options) => {
    request = JSON.parse(options.body);
    return Response.json({ choices: [{ message: { content: '요가 수업 이야기를 들려줘서 고마워요. 오늘 밤은 편히 쉬어요.' } }] });
  });
  const signalPost = body => post(base, body, {}, '/api/signal');
  const chatOnly = [user('오늘 요가 수업에 처음 갔어요.'), assistant('첫 수업이라니 멋져요.')];
  const response = await signalPost({ character, user: profile, diary: null, messages: chatOnly });
  assert.equal(response.status, 200);
  assert.deepEqual(JSON.parse(request.messages[1].content), { todayChat: chatOnly });
  assert.match(request.messages[0].content, /otherwise base it on today's chat/);
  assert.equal((await signalPost({ character, user: profile, diary: null, messages: [] })).status, 400);
  assert.equal((await signalPost({ character, user: profile, diary: { text: '감정 없음' }, messages: chatOnly })).status, 400);
});
