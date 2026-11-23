import { Platform } from 'react-native';
import { characterPrompt, conversationContext, userPrompt } from './model.js';

function apiUrl(path) {
  if (Platform.OS === 'web') return path;
  const address = process.env.EXPO_PUBLIC_SIGNAL_API_URL?.trim();
  if (!address) return null;
  const url = new URL(address);
  const [a, b] = url.hostname.split('.').map(Number);
  const privateHost = url.hostname === 'localhost' || url.hostname === '127.0.0.1'
    || a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31);
  if (!['http:', 'https:'].includes(url.protocol) || !privateHost || url.username || url.password) return null;
  return new URL(path, url.origin).href;
}

async function request(path, options, timeoutMs) {
  const url = apiUrl(path);
  if (!url) throw new Error('테스트 기기에서 개발 PC의 AI 서버 주소를 설정해 주세요.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export async function chatStatus() {
  try {
    const response = await request('/api/chat/status', {}, 2_000);
    if (response.ok) {
      const { available, provider } = await response.json();
      return { available: available === true, provider: provider === 'baze' ? 'baze' : 'local' };
    }
  } catch {
    // The status request is retried while the room is open.
  }
  return { available: false, provider: null };
}

export async function getReply(person, profile, thread, bazeConsent = false) {
  return post('/api/chat', {
    character: characterPrompt(person), user: userPrompt(profile), messages: conversationContext(thread),
  }, bazeConsent, 50_000);
}

export async function getDiaryResult(characters, profile, diary, bazeConsent = false) {
  const result = await post('/api/diary', {
    characters: characters.map(characterPrompt), user: userPrompt(profile), diary: { emoji: diary.emoji, text: diary.text },
  }, bazeConsent, 150_000);
  if (typeof result.comment !== 'string' || !result.comment.trim() || !Array.isArray(result.reactions)
    || result.reactions.length !== 2 || !result.reactions.every(item => typeof item === 'string' && item.trim())) {
    throw new Error('응원 메시지를 불러오지 못했어요.');
  }
  return { comment: result.comment.trim(), reactions: result.reactions.map(item => item.trim()), source: 'ai' };
}

export async function getSignal(prepared, profile, bazeConsent = false) {
  const result = await post('/api/signal', {
    character: characterPrompt(prepared.sender), user: userPrompt(profile), diary: prepared.diary, messages: prepared.messages,
  }, bazeConsent, 60_000);
  if (typeof result.reply !== 'string' || !result.reply.trim()) throw new Error('시그널을 받지 못했어요.');
  return result.reply.trim();
}

async function post(path, payload, bazeConsent, timeoutMs) {
  let response;
  try {
    response = await request(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...payload, ...(bazeConsent ? { bazeConsent: true } : {}) }),
    }, timeoutMs);
  } catch {
    throw new Error('AI 서버에 연결하지 못했어요. 연결을 확인하고 다시 시도해 주세요.');
  }
  if (response.status === 429) throw new Error('다른 답장을 준비하고 있어요. 잠시 뒤 다시 시도해 주세요.');
  if (!response.ok) {
    const { error } = await response.json().catch(() => ({}));
    if (error === 'baze_consent_required') throw new Error('베이즈 전송 안내를 확인하고 다시 시도해 주세요.');
    if (error === 'baze_access') throw new Error('베이즈 API 키와 GPT-6 Luna 사용 권한을 확인해 주세요.');
    if (error === 'baze_limit') throw new Error('베이즈 크레딧 또는 호출 한도를 확인해 주세요.');
    throw new Error('답장을 받지 못했어요. 잠시 뒤 다시 시도해 주세요.');
  }
  const result = await response.json();
  if (result.reply !== undefined && (typeof result.reply !== 'string' || !result.reply.trim() || !['ai', 'safety'].includes(result.source))) {
    throw new Error('답장을 받지 못했어요. 다시 시도해 주세요.');
  }
  return result;
}
