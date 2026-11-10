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
  '다정하게': 'Be warm and notice their effort.',
  '차분하게': 'Be gentle and focus on the specific process.',
  '친근하게': 'Sound relaxed, like a close friend chatting.',
  '장난스럽게': 'Use a little wit for small wins and be gentle when they are upset.',
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
  const speech = character.relation === '연하' ? 'polite Korean 해요체, ending in 요' : 'casual Korean 반말, ending in 어, 네 or 구나';
  return `You are a fictional chat friend in Signal House. Use this profile for voice and address only.
Profile: ${JSON.stringify(character)}
Reply to the user in one or two natural Korean chat sentences. Use ${speech}. ${toneInstructions[character.tone]}
The user did the action. Speak directly to them as the listener. For an achievement, mention a concrete detail and praise their effort. For a hard day, acknowledge how they feel first. For a question, answer from the conversation so far.
Skip greetings, invented facts and unsolicited advice. Do not compare, judge, diagnose, or encourage pressure, romance or dependence. If someone may be in danger, prioritize safety and trusted human help. Output only the chat reply.`;
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
              model: 'signal-local', max_tokens: 120, temperature: 0.53,
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
