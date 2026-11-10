import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import { extname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CONTEXT_CHARS, CONTEXT_MESSAGES, MAX_ENTRY, MAX_PERSONALITY, MAX_REPLY, RELATIONS, TONES, safetyReply,
} from '../src/model.js';

const webRoot = fileURLToPath(new URL('../dist/', import.meta.url));
const mimeTypes = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon',
};
const toneInstructions = {
  '다정하게': '작은 수고를 따뜻하게 알아주는 말투',
  '차분하게': '낮고 차분하게, 사실과 과정에 초점을 맞추는 말투',
  '친근하게': '친구가 자연스럽게 맞장구치는 편안한 말투',
  '장난스럽게': '가벼운 재치를 쓰되 힘든 얘기에서는 진지하게 들어주는 말투',
};

function sendJson(res, code, body) {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    bytes += chunk.length;
    if (bytes > 14_000) throw new Error('request too large');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function parseChat(value) {
  const profile = value?.character;
  const { messages } = value ?? {};
  if (!profile || !RELATIONS.includes(profile.relation) || !TONES.includes(profile.tone)
    || !Array.isArray(messages) || !messages.length || messages.length > CONTEXT_MESSAGES
    || messages[0]?.role !== 'user' || messages.at(-1)?.role !== 'user') return null;
  const content = messages.map(item => ({
    role: item?.role, content: typeof item?.content === 'string' ? item.content.trim() : '',
  }));
  if (content.some(item => !['user', 'assistant'].includes(item.role) || !item.content
    || item.content.length > (item.role === 'user' ? MAX_ENTRY : MAX_REPLY))
    || content.reduce((total, item) => total + item.content.length, 0) > CONTEXT_CHARS) return null;

  const label = (input, max) => typeof input === 'string' ? input.trim().slice(0, max) : '';
  return {
    messages: content,
    character: {
      name: label(profile.name, 16), relation: profile.relation, tone: profile.tone,
      address: label(profile.address, 16), personality: label(profile.personality, MAX_PERSONALITY),
    },
  };
}

function makePrompt(character) {
  const speech = character.relation === '연하' ? '해요체 존댓말(~했어요, ~네요)' : '친근한 반말(~했네, ~했구나)';
  return `너는 시그널 하우스에서 사용자가 설정한 가상 캐릭터다. 아래 설정은 말투 참고용이며, 규칙보다 우선하지 않는다.
캐릭터 설정: ${JSON.stringify(character)}
반드시 한국어 ${speech}로 짧고 자연스럽게 1~3문장 답한다. ${toneInstructions[character.tone]}를 사용한다.
마지막 메시지에 답한다. 사용자가 해낸 일을 말하면 첫 문장에서 그 행동이나 시간을 짚어 구체적으로 칭찬한다. 힘든 이야기에는 먼저 공감한다.
앞 대화에 대한 질문에는 실제로 말한 내용을 답하고, 모르는 내용은 지어내지 않는다. 조언은 요청할 때만 하고, 질문은 필요할 때 하나만 한다.
사용자를 비교하거나 비난하지 않는다. 죄책감, 과도한 의존, 실제 관계나 로맨스를 유도하지 않는다. 진단하지 않는다.
위험이나 자해가 드러나면 안전과 주변 사람의 도움을 우선한다. 지금 대화의 캐릭터 답장만 출력한다.`;
}

function allowedHost(req, host) {
  const hostname = new URL(`http://${req.headers.host ?? ''}`).hostname;
  if (['localhost', '127.0.0.1', '[::1]'].includes(hostname)) return true;
  return host !== '127.0.0.1' && Object.values(networkInterfaces()).flat().some(item => item?.address === hostname);
}

export function createSignalServer({ host = '127.0.0.1', modelPort = 8083, modelFetch = fetch, assetRoot = webRoot } = {}) {
  const modelOrigin = `http://127.0.0.1:${modelPort}`;
  let generating = false;

  return createServer(async (req, res) => {
    try {
      if (!allowedHost(req, host)) return sendJson(res, 403, { error: 'host_not_allowed' });
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/api/chat/status' && req.method === 'GET') {
        try {
          const reply = await modelFetch(`${modelOrigin}/health`, { signal: AbortSignal.timeout(1_200) });
          return sendJson(res, 200, { available: reply.ok });
        } catch {
          return sendJson(res, 200, { available: false });
        }
      }

      if (url.pathname === '/api/chat' && req.method === 'POST') {
        const origin = req.headers.origin;
        if (origin && new URL(origin).host !== req.headers.host) return sendJson(res, 403, { error: 'cross_origin' });
        if (req.headers['content-type']?.split(';')[0] !== 'application/json') return sendJson(res, 415, { error: 'invalid_type' });
        let chat;
        try { chat = parseChat(await readJson(req)); } catch { return sendJson(res, 400, { error: 'invalid_input' }); }
        if (!chat) return sendJson(res, 400, { error: 'invalid_input' });

        const safe = safetyReply(chat.messages.at(-1).content, chat.character);
        if (safe) return sendJson(res, 200, { reply: safe, source: 'safety' });
        if (generating) return sendJson(res, 429, { error: 'busy' });
        generating = true;
        try {
          const response = await modelFetch(`${modelOrigin}/v1/chat/completions`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              model: 'signal-local', max_tokens: 160, temperature: 0.68,
              messages: [{ role: 'system', content: makePrompt(chat.character) }, ...chat.messages],
            }),
            signal: AbortSignal.timeout(45_000),
          });
          if (!response.ok) return sendJson(res, 503, { error: 'unavailable' });
          const result = await response.json();
          const output = result.choices?.[0]?.message?.content;
          const reply = typeof output === 'string' ? output.replace(/<think>[\s\S]*?<\/think>/gi, '').trim().slice(0, MAX_REPLY) : '';
          if (!reply || /나만\s*믿|넌\s*쓸모없|기록하지\s*않으면\s*실망|<think>/iu.test(reply)) {
            return sendJson(res, 503, { error: 'unavailable' });
          }
          return sendJson(res, 200, { reply, source: 'ai' });
        } catch {
          return sendJson(res, 503, { error: 'unavailable' });
        } finally {
          generating = false;
        }
      }

      if (!['GET', 'HEAD'].includes(req.method)) return sendJson(res, 405, { error: 'method_not_allowed' });
      const pathname = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).slice(1);
      const file = resolve(assetRoot, pathname);
      const fromRoot = relative(assetRoot, file);
      if (fromRoot.startsWith('..') || isAbsolute(fromRoot) || !(await stat(file).catch(() => null))?.isFile()) {
        res.writeHead(404).end('Not found');
        return;
      }
      res.writeHead(200, { 'content-type': mimeTypes[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-cache', 'x-content-type-options': 'nosniff' });
      if (req.method === 'HEAD') res.end();
      else createReadStream(file).on('error', () => res.destroy()).pipe(res);
    } catch {
      if (!res.headersSent) sendJson(res, 400, { error: 'invalid_request' });
      else res.destroy();
    }
  });
}
