export const AVATARS = Object.freeze([
  { id: 'sol', label: '솔 아바타', color: '#F5DBCF' },
  { id: 'haon', label: '하온 아바타', color: '#EDE2BD' },
  { id: 'ian', label: '이안 아바타', color: '#DDE7D6' },
  { id: 'roa', label: '로아 아바타', color: '#EAE0F3' },
]);
export const RELATIONS = ['동갑', '연상', '연하'];
export const TONES = ['장난스럽게', '친근하게', '차분하게', '다정하게'];
export const STORAGE_KEY = 'signal-house-team-v1';
export const MAX_ENTRY = 500;
export const MAX_PHOTO = 180_000;
export const MAX_PERSONALITY = 200;
export const MAX_REPLY = 650;
export const CONTEXT_MESSAGES = 10;
export const CONTEXT_CHARS = 1_800;

export const DEFAULT_CHARACTERS = Object.freeze([
  { id: 'first', name: '솔', avatar: 'sol', relation: '동갑', address: '', tone: '다정하게', photo: '' },
  { id: 'second', name: '하온', avatar: 'haon', relation: '연하', address: '', tone: '차분하게', photo: '' },
]);

export const TONE_PROFILES = {
  '장난스럽게': { trait: '가벼운 비유로 분위기를 풀어요', example: '오늘의 작은 장면, 마음속 앨범에 한 장 추가!' },
  '친근하게': { trait: '친구처럼 편하게 맞장구쳐요', example: '오늘 그 일 얘기해 줘서 고마워. 그 수고를 같이 기억하자.' },
  '차분하게': { trait: '과정을 구체적으로 짚고 서두르지 않아요', example: '오늘 들인 시간과 마음도 기록할 만해요.' },
  '다정하게': { trait: '작은 행동에 담긴 수고를 따뜻하게 바라봐요', example: '작은 행동 하나에도 네가 들인 마음이 있었겠다.' },
};

export function emptyState() {
  return { version: 1, characters: [], entries: [], threads: {} };
}

export function cleanCharacter(value, id) {
  if (!value || typeof value.name !== 'string' || !value.name.trim()
    || !AVATARS.some(avatar => avatar.id === value.avatar)
    || !RELATIONS.includes(value.relation) || !TONES.includes(value.tone)) return null;
  const photo = typeof value.photo === 'string' && value.photo.length <= MAX_PHOTO
    && /^data:image\/(?:jpeg|png);base64,[a-z0-9+/=]+$/i.test(value.photo) ? value.photo : '';
  return {
    id, name: value.name.trim().slice(0, 16), avatar: value.avatar, relation: value.relation,
    address: typeof value.address === 'string' ? value.address.trim().slice(0, 16) : '',
    personality: typeof value.personality === 'string' ? value.personality.trim().slice(0, MAX_PERSONALITY) : '',
    tone: value.tone, photo,
  };
}

export function readState(value) {
  if (!value) return emptyState();
  const raw = JSON.parse(value);
  if (raw?.version !== 1 || !Array.isArray(raw.characters) || !Array.isArray(raw.entries)) {
    throw new Error('저장된 데이터를 읽지 못했어요.');
  }
  const characters = DEFAULT_CHARACTERS.map((preset, index) => cleanCharacter(raw.characters[index], preset.id));
  return {
    version: 1, characters: characters.every(Boolean) ? characters : [],
    threads: Object.fromEntries(DEFAULT_CHARACTERS.flatMap(({ id }) => {
      const messages = raw.threads?.[id];
      return Array.isArray(messages) ? [[id, messages.filter(validMessage)]] : [];
    })),
    entries: raw.entries.filter(entry => typeof entry?.id === 'string' && typeof entry.text === 'string'
      && typeof entry.date === 'string' && Number.isFinite(Date.parse(entry.createdAt))
      && ['prepared', 'generated', 'fallback', 'safety', 'support'].includes(entry.status)
      && Array.isArray(entry.replies) && entry.replies.length === 2
      && entry.replies.every(reply => typeof reply?.name === 'string' && typeof reply.message === 'string'
        && typeof reply.id === 'string' && AVATARS.some(avatar => avatar.id === reply.avatar))),
  };
}

function validMessage(message) {
  return typeof message?.id === 'string' && ['user', 'assistant'].includes(message.role)
    && typeof message.text === 'string' && message.text.trim().length > 0
    && message.text.length <= (message.role === 'user' ? MAX_ENTRY : MAX_REPLY)
    && typeof message.createdAt === 'string' && Number.isFinite(Date.parse(message.createdAt));
}

export function newMessage(role, value, source, now = new Date()) {
  const text = typeof value === 'string' ? value.trim() : '';
  const message = { id: `${now.getTime()}-${Math.random().toString(36).slice(2, 10)}`,
    role, text, createdAt: now.toISOString(), ...(source ? { source } : {}) };
  if (!validMessage(message)) throw new Error('보낼 이야기는 1~500자로 적어 주세요.');
  return message;
}

export function conversationContext(thread) {
  let characters = 0;
  const context = [];
  for (const message of thread.slice(-CONTEXT_MESSAGES).reverse()) {
    if (characters + message.text.length > CONTEXT_CHARS) break;
    characters += message.text.length;
    context.unshift({ role: message.role, content: message.text });
  }
  if (context[0]?.role === 'assistant') context.shift();
  return context;
}

export function localDate(now = new Date()) {
  const pad = value => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function dateLabel(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })
    .format(new Date(year, month - 1, day, 12));
}

function category(text) {
  if (/(죽고\s*싶|자살|자해|목숨.{0,10}(끊|버리)|해치고\s*싶|해칠\s*거|학대|폭력을?\s*당)/u.test(text)) return 'safety';
  if (/(힘들|불안|우울|막막|지쳤|울었|두렵|망했|실패|슬펐|못했|못\s*하|때렸|괴롭혔|훔쳤)/u.test(text)) return 'support';
  return 'ordinary';
}

export function safetyReply(text, character) {
  return category(text) === 'safety' ? preparedReply(character, text, 'safety') : null;
}

function entryExcerpt(text) {
  const chars = Array.from(text.trim().replace(/\s+/g, ' '));
  return chars.slice(0, 65).join('') + (chars.length > 65 ? '…' : '');
}

function preparedReply(character, text, kind) {
  const formal = character.relation === '연하';
  if (kind === 'safety') {
    return formal
      ? '이야기해 주셔서 고마워요. 지금은 안전이 먼저예요. 다칠 위험이 있다면 안전한 곳으로 이동하고, 가까운 믿을 만한 어른이나 사람에게 지금 상황을 알려 도움을 요청해 주세요.'
      : '이야기해 줘서 고마워. 지금은 안전이 먼저야. 다칠 위험이 있다면 안전한 곳으로 이동하고, 가까운 믿을 만한 어른이나 사람에게 지금 상황을 알려 도움을 요청해 줘.';
  }
  if (kind === 'support') {
    return formal
      ? '그 이야기를 꺼내기까지 마음이 무거웠을 수 있겠어요. 지금은 잠깐 숨을 고르고, 마음에 걸리는 부분이 있다면 믿을 만한 사람에게 나눠도 괜찮아요.'
      : '마음에 걸린 일을 적어줬구나. 잠깐 숨을 고르고, 혼자 감당하기 어렵다면 믿을 만한 사람에게 이야기해도 괜찮아.';
  }

  const address = character.address ? `${character.address}, ` : '';
  const excerpt = `“${entryExcerpt(text)}”`;
  const lines = {
    '장난스럽게': [
      `${excerpt} 오늘의 작은 장면 하나 발견! 마음속 앨범에 한 장 넣어둘 만해.`,
      `${excerpt} 오늘의 작은 장면을 찾았어요! 마음속 앨범에 한 장 넣어둘 만해요.`,
    ],
    '친근하게': [
      `${excerpt} 얘기해 줘서 고마워. 그렇게 하루에 한 조각씩 남겨두는 거, 나는 좋더라.`,
      `${excerpt} 얘기해 줘서 고마워요. 오늘의 일을 이렇게 한 조각 남겨둔 게 좋아요.`,
    ],
    '차분하게': [
      `${excerpt}라고 적었네. 오늘 그 일에 들인 시간과 마음을 천천히 돌아봐도 좋아.`,
      `${excerpt}라고 적어주셨네요. 오늘 그 일에 들인 시간과 마음도 돌아볼 만해요.`,
    ],
    '다정하게': [
      `${excerpt} 들려줘서 고마워. 그 일에 들인 작은 수고도 오늘의 소중한 부분이야.`,
      `${excerpt} 들려주셔서 고마워요. 그 일에 들인 작은 수고도 오늘의 소중한 부분이에요.`,
    ],
  };
  return address + lines[character.tone][formal ? 1 : 0];
}

function recordReplies(characters, messages) {
  return characters.map((character, index) => ({
    id: character.id, name: character.name, avatar: character.avatar, message: messages[index],
  }));
}

const REPLY_POLICY = '사용자가 쓴 구체적인 행동만 인정한다. 기록에 없는 사실을 지어내지 않고, 평가·비교·비난·죄책감·압박·의존 유도를 피한다. 선택한 관계와 말투로 짧게 답한다.';

export async function makeEntry(value, characters, { now = new Date(), generate, timeoutMs = 4_000 } = {}) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > MAX_ENTRY) throw new Error('이야기를 1~500자로 적어 주세요.');
  if (characters.length !== 2) throw new Error('캐릭터 두 명을 먼저 설정해 주세요.');

  const kind = category(text);
  let status = kind === 'ordinary' ? 'prepared' : kind;
  let messages = characters.map(character => preparedReply(character, text, kind));

  // A provider is opt-in. The shipped prototype uses local responses only.
  if (generate && kind === 'ordinary') {
    const controller = new AbortController();
    let timeout;
    try {
      const deadline = new Promise((_, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(new Error('response timed out'));
        }, timeoutMs);
      });
      const profiles = characters.map(({ id, relation, tone }) => ({ id, relation, tone }));
      const generated = await Promise.race([
        Promise.resolve().then(() => generate({ text, profiles, policy: REPLY_POLICY, signal: controller.signal })),
        deadline,
      ]);
      if (!Array.isArray(generated) || generated.length !== 2 || !generated.every(message =>
        typeof message === 'string' && message.trim() && message.length <= 650
        && !/(나만\s*믿|실망할|꼭\s*기록해야|쓸모없)/u.test(message))) throw new Error('invalid responses');
      messages = generated.map(message => message.trim());
      status = 'generated';
    } catch {
      status = 'fallback';
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    id: `${now.getTime()}-${Math.random().toString(36).slice(2, 9)}`,
    date: localDate(now), createdAt: now.toISOString(), text, status,
    replies: recordReplies(characters, messages),
  };
}
