import { sha256 } from './sha256.js';

export const AVATARS = Object.freeze([
  { id: 'sol', label: '보라 아바타', color: '#E2D3F3' },
  { id: 'haon', label: '민트 아바타', color: '#D4E9DF' },
  { id: 'ian', label: '초록 아바타', color: '#DDE7D6' },
  { id: 'roa', label: '라일락 아바타', color: '#EAE0F3' },
]);
export const RELATIONS = ['연상', '연하', '친구', '기타'];
export const STYLES = ['다정하게', '차분하게', '재미있게'];
export const USER_GENDERS = ['여성', '남성', '직접 입력', '응답하지 않음'];
export const CHARACTER_GENDERS = ['여성', '남성', '직접 입력', '설정하지 않음'];
export const MOODS = Object.freeze([
  { emoji: '😊', label: '아주 좋아요', question: '오늘 가장 좋았던 장면은 무엇이었나요?' },
  { emoji: '🙂', label: '괜찮아요', question: '오늘 해낸 작은 일 하나를 들려주세요.' },
  { emoji: '😐', label: '그저 그래요', question: '별일 없던 하루에도 기억하고 싶은 순간이 있었나요?' },
  { emoji: '😔', label: '조금 처졌어요', question: '오늘 마음을 무겁게 한 일이 있었나요? 편하게 적어도 괜찮아요.' },
  { emoji: '😣', label: '힘들었어요', question: '힘든 하루를 버텨낸 순간이 있었나요? 있는 그대로 적어 주세요.' },
]);
export const STAGES = Object.freeze([
  { min: 0, name: '알아가는 중' },
  { min: 20, name: '편한 사이' },
  { min: 50, name: '가까운 사이' },
  { min: 80, name: '오랜 친구' },
]);
export const CHARACTER_COLORS = Object.freeze({
  first: { main: '#C9507C', soft: '#FDF0F4', border: '#F4D6E1' },
  second: { main: '#23857D', soft: '#EAF6F3', border: '#C9E7E0' },
});
export const STORAGE_KEY = 'harusignal-v2';
export const MAX_ENTRY = 500;
export const MAX_DIARY = 1_000;
export const MAX_PHOTO = 180_000;
export const MAX_NOTE = 200;
export const MAX_REPLY = 650;
export const CONTEXT_MESSAGES = 10;
export const CONTEXT_CHARS = 1_800;
export const SIGNAL_HOUR = 22;
export const BACKGROUND_IDS = ['lavender', 'cream', 'pink', 'sky', 'mint'];
export const AFFINITY = Object.freeze({ diary: 5, chat: 1, chatDailyMax: 5, correctGuess: 3, max: 100 });
export const CHARACTER_IDS = ['first', 'second'];

export const DEFAULT_PROFILE = Object.freeze({
  loginId: '', nickname: '', likes: '', dislikes: '', mbti: '', gender: '응답하지 않음', genderCustom: '',
});

export const DEFAULT_CHARACTERS = Object.freeze([
  {
    id: 'first', name: '윤서', avatar: 'sol', photo: '', address: '', relation: '친구', relationCustom: '',
    style: '다정하게', casual: true, gender: '설정하지 않음', genderCustom: '', mbti: '', preference: '',
  },
  {
    id: 'second', name: '하온', avatar: 'haon', photo: '', address: '', relation: '연하', relationCustom: '',
    style: '차분하게', casual: false, gender: '설정하지 않음', genderCustom: '', mbti: '', preference: '',
  },
]);

const text = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const pick = (value, options, fallback) => options.includes(value) ? value : fallback;
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
const validTime = value => typeof value === 'string' && Number.isFinite(Date.parse(value));

export function emptyState() {
  return { version: 2, accounts: [], sessionId: null, pending: null, users: {} };
}

export function emptyUser(profile = DEFAULT_PROFILE) {
  return {
    profile: { ...DEFAULT_PROFILE, ...profile },
    characters: DEFAULT_CHARACTERS.map(item => ({ ...item })),
    onboarding: { step: 'characters', index: 0, done: [false, false] },
    affinity: { first: 0, second: 0 },
    chatGains: {},
    threads: { first: [], second: [] },
    readThrough: { first: '', second: '' },
    diaries: [],
    signals: [],
    background: 'lavender',
  };
}

// ---------- 계정 ----------

export function hashPassword(password, salt) {
  let value = `${salt}:${password}`;
  for (let i = 0; i < 300; i += 1) value = sha256(`${salt}:${value}:${i}`);
  return value;
}

function randomId(length = 16) {
  const bytes = new Uint8Array(length);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
  else for (let i = 0; i < length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

export function checkAccountInput({ loginId, password }) {
  const id = text(loginId, 40).toLowerCase();
  const errors = {};
  if (!id) errors.loginId = '아이디를 입력해 주세요.';
  else if (!/^[a-z0-9._-]{4,20}$/.test(id)) errors.loginId = '아이디는 영문 소문자·숫자 4~20자로 적어 주세요.';
  if (!password) errors.password = '비밀번호를 입력해 주세요.';
  else if (password.length < 6 || password.length > 64) errors.password = '비밀번호는 6~64자로 적어 주세요.';
  return { id, errors };
}

export function createAccount(state, { loginId, password, profile, characters }, now = new Date()) {
  const { id, errors } = checkAccountInput({ loginId, password });
  if (Object.keys(errors).length) return { errors };
  if (state.accounts.some(account => account.loginId === id)) return { errors: { loginId: '이 기기에 이미 있는 아이디예요.' } };
  const salt = randomId(12);
  const accountId = randomId(8);
  const account = { id: accountId, loginId: id, salt, hash: hashPassword(password, salt), createdAt: now.toISOString() };
  let user = emptyUser({ ...cleanProfile(profile), loginId: id });
  if (characters?.length === 2 && characters.every(item => !Object.keys(characterErrors(item)).length)) {
    user = finishOnboarding({ ...user, characters: characters.map((item, i) => cleanCharacter(item, CHARACTER_IDS[i])) }, now);
  }
  return {
    state: { ...state, accounts: [...state.accounts, account], sessionId: accountId, pending: null, users: { ...state.users, [accountId]: user } },
  };
}

/** Starts without an account. The data stays on this device until the user adds a login later. */
export function createGuest(state, { profile, characters }, now = new Date()) {
  const accountId = randomId(8);
  const account = { id: accountId, loginId: '', salt: '', hash: '', guest: true, createdAt: now.toISOString() };
  let user = emptyUser({ ...cleanProfile(profile), loginId: '' });
  if (characters?.length === 2 && characters.every(item => !Object.keys(characterErrors(item)).length)) {
    user = finishOnboarding({ ...user, characters: characters.map((item, i) => cleanCharacter(item, CHARACTER_IDS[i])) }, now);
  }
  return { state: { ...state, accounts: [...state.accounts, account], sessionId: accountId, pending: null, users: { ...state.users, [accountId]: user } } };
}

export function isGuest(state) {
  return Boolean(state?.accounts.find(item => item.id === state.sessionId)?.guest);
}

/** Adds a login to the signed-in guest. Everything already saved stays with the same user. */
export function registerAccount(state, { loginId, password }) {
  const account = state.accounts.find(item => item.id === state.sessionId);
  if (!account?.guest) return { failed: '이미 로그인 계정이 있어요.' };
  const { id, errors } = checkAccountInput({ loginId, password });
  if (Object.keys(errors).length) return { errors };
  if (state.accounts.some(item => item.loginId === id)) return { errors: { loginId: '이 기기에 이미 있는 아이디예요.' } };
  const salt = randomId(12);
  const registered = { id: account.id, loginId: id, salt, hash: hashPassword(password, salt), createdAt: account.createdAt };
  const user = state.users[account.id];
  return {
    state: {
      ...state,
      accounts: state.accounts.map(item => item.id === account.id ? registered : item),
      users: { ...state.users, [account.id]: { ...user, profile: { ...user.profile, loginId: id } } },
    },
  };
}

export function login(state, { loginId, password }) {
  const id = text(loginId, 40).toLowerCase();
  const errors = {};
  if (!id) errors.loginId = '아이디를 입력해 주세요.';
  if (!password) errors.password = '비밀번호를 입력해 주세요.';
  if (Object.keys(errors).length) return { errors };
  const account = state.accounts.find(item => !item.guest && item.loginId === id);
  if (!account || hashPassword(password, account.salt) !== account.hash || !state.users[account.id]) {
    return { failed: '로그인 정보를 확인해 주세요.' };
  }
  return { state: { ...state, sessionId: account.id } };
}

export function logout(state) {
  return { ...state, sessionId: null };
}

export function deleteAccount(state, accountId) {
  const { [accountId]: _removed, ...users } = state.users;
  return { ...state, accounts: state.accounts.filter(item => item.id !== accountId), users, sessionId: null };
}

export function currentUser(state) {
  return state?.sessionId ? state.users[state.sessionId] ?? null : null;
}

export function updateUser(state, change) {
  const user = currentUser(state);
  if (!user) return state;
  const next = change(user);
  return next === user ? state : { ...state, users: { ...state.users, [state.sessionId]: next } };
}

// ---------- 프로필 ----------

export function cleanProfile(value = {}) {
  const gender = pick(value.gender, USER_GENDERS, '응답하지 않음');
  return {
    loginId: text(value.loginId, 20),
    nickname: text(value.nickname, 16),
    likes: text(value.likes, MAX_NOTE),
    dislikes: text(value.dislikes, MAX_NOTE),
    mbti: text(value.mbti, 12),
    gender,
    genderCustom: gender === '직접 입력' ? text(value.genderCustom, 16) : '',
  };
}

export function profileErrors(value) {
  return text(value?.nickname, 16) ? {} : { nickname: '이름을 입력해 주세요.' };
}

export function cleanCharacter(value, id) {
  const preset = DEFAULT_CHARACTERS.find(item => item.id === id) ?? DEFAULT_CHARACTERS[0];
  // '동갑'은 선택지에서 빠졌어요. 예전에 저장된 값은 '친구'로 옮겨요.
  const relation = value?.relation === '동갑' ? '친구' : pick(value?.relation, RELATIONS, preset.relation);
  const gender = pick(value?.gender, CHARACTER_GENDERS, '설정하지 않음');
  const photo = typeof value?.photo === 'string' && value.photo.length <= MAX_PHOTO
    && /^data:image\/(?:jpeg|png);base64,[a-z0-9+/=]+$/i.test(value.photo) ? value.photo : '';
  return {
    id,
    name: text(value?.name, 16),
    avatar: AVATARS.some(avatar => avatar.id === value?.avatar) ? value.avatar : preset.avatar,
    photo,
    address: text(value?.address, 16),
    relation,
    relationCustom: relation === '기타' ? text(value?.relationCustom, 16) : '',
    style: pick(value?.style, STYLES, preset.style),
    casual: typeof value?.casual === 'boolean' ? value.casual : preset.casual,
    gender,
    genderCustom: gender === '직접 입력' ? text(value?.genderCustom, 16) : '',
    mbti: text(value?.mbti, 12),
    preference: text(value?.preference, MAX_NOTE),
  };
}

export function characterErrors(value) {
  const errors = {};
  if (!text(value?.name, 16)) errors.name = '캐릭터 이름을 입력해 주세요.';
  if (!text(value?.address, 16)) errors.address = '나를 부를 호칭을 입력해 주세요.';
  return errors;
}

/** Korean particle after a name: josa('하온', '이', '가') → '하온이'. */
export function josa(name, withFinal, withoutFinal) {
  const code = (name ?? '').trim().slice(-1).charCodeAt(0);
  const final = code >= 0xac00 && code <= 0xd7a3 ? (code - 0xac00) % 28 !== 0 : false;
  return name + (final ? withFinal : withoutFinal);
}

export function relationLabel(person) {
  return person.relation === '기타' ? person.relationCustom || '기타' : person.relation;
}

export function genderLabel(value, custom) {
  return value === '직접 입력' ? custom || '직접 입력' : value;
}

/** Text profile sent to the AI server. Photos never leave the device. */
export function characterPrompt(person) {
  const { name, address, style, casual, mbti, preference } = person;
  const gender = ['설정하지 않음', '응답하지 않음'].includes(person.gender) ? '' : genderLabel(person.gender, person.genderCustom);
  return { name, address, relation: relationLabel(person), style, casual, gender, mbti, preference };
}

export function userPrompt(profile) {
  const gender = profile.gender === '응답하지 않음' ? '' : genderLabel(profile.gender, profile.genderCustom);
  return { nickname: profile.nickname, likes: profile.likes, dislikes: profile.dislikes, mbti: profile.mbti, gender };
}

// ---------- 저장 데이터 읽기 ----------

export function readState(value) {
  if (!value) return emptyState();
  const raw = JSON.parse(value);
  if (raw?.version !== 2 || !Array.isArray(raw.accounts) || typeof raw.users !== 'object' || !raw.users) {
    throw new Error('저장된 데이터를 읽지 못했어요.');
  }
  const accounts = raw.accounts.filter(item => typeof item?.id === 'string' && typeof item.loginId === 'string'
    && typeof item.salt === 'string' && typeof item.hash === 'string' && (item.guest === true || item.loginId));
  const users = Object.fromEntries(accounts.filter(item => raw.users[item.id]).map(item => [item.id, readUser(raw.users[item.id])]));
  const sessionId = users[raw.sessionId] ? raw.sessionId : null;
  const pending = raw.pending && typeof raw.pending === 'object' ? readPending(raw.pending) : null;
  return { version: 2, accounts: accounts.filter(item => users[item.id]), sessionId, pending, users };
}

export function emptyPending() {
  return { step: 'profile', profile: { ...DEFAULT_PROFILE }, characters: DEFAULT_CHARACTERS.map(item => ({ ...item, name: '', address: '' })),
    done: [false, false], index: 0 };
}

function readPending(raw) {
  const base = emptyPending();
  return {
    step: ['profile', 'characters', 'account'].includes(raw.step) ? raw.step : 'profile',
    profile: cleanProfile(raw.profile),
    characters: CHARACTER_IDS.map((id, index) => raw.characters?.[index] ? { ...base.characters[index], ...raw.characters[index], id } : base.characters[index]),
    done: CHARACTER_IDS.map((_, i) => raw.done?.[i] === true),
    index: raw.index === 1 ? 1 : 0,
  };
}

function readUser(raw) {
  const base = emptyUser(cleanProfile(raw.profile));
  const characters = CHARACTER_IDS.map((id, index) => cleanCharacter(raw.characters?.[index] ?? DEFAULT_CHARACTERS[index], id));
  const done = Array.isArray(raw.onboarding?.done) ? CHARACTER_IDS.map((_, i) => raw.onboarding.done[i] === true) : [false, false];
  const step = raw.onboarding?.step === 'done' && done.every(Boolean) ? 'done' : 'characters';
  const threads = Object.fromEntries(CHARACTER_IDS.map(id => [id, Array.isArray(raw.threads?.[id]) ? raw.threads[id].filter(validMessage) : []]));
  const readThrough = Object.fromEntries(CHARACTER_IDS.map(id => {
    const seen = raw.readThrough?.[id];
    return [id, seen === '' || threads[id].some(message => message.id === seen) ? seen : threads[id].at(-1)?.id ?? ''];
  }));
  const affinity = Object.fromEntries(CHARACTER_IDS.map(id => [id, clampAffinity(raw.affinity?.[id])]));
  // A diary left in "pending" means the app closed while the AI was writing; offer a retry instead.
  const diaries = Array.isArray(raw.diaries)
    ? raw.diaries.filter(validDiary).map(diary => diary.status === 'pending' ? { ...diary, status: 'failed' } : diary) : [];
  const signals = Array.isArray(raw.signals) ? raw.signals.filter(validSignal) : [];
  const chatGains = raw.chatGains && typeof raw.chatGains === 'object' ? raw.chatGains : {};
  return {
    ...base, characters,
    onboarding: { step, index: raw.onboarding?.index === 1 ? 1 : 0, done },
    affinity, chatGains, threads, readThrough, diaries, signals,
    background: BACKGROUND_IDS.includes(raw.background) ? raw.background : 'lavender',
  };
}

function clampAffinity(value) {
  return Number.isFinite(value) ? Math.max(0, Math.min(AFFINITY.max, Math.round(value))) : 0;
}

function validMessage(message) {
  return typeof message?.id === 'string' && ['user', 'assistant'].includes(message.role)
    && typeof message.text === 'string' && message.text.trim().length > 0
    && message.text.length <= (message.role === 'user' ? MAX_ENTRY : MAX_REPLY + 40)
    && validTime(message.createdAt);
}

function validDiary(diary) {
  if (!validDate(diary?.date)) return false;
  if (diary.deleted === true) return true;
  return MOODS.some(mood => mood.emoji === diary.emoji) && typeof diary.text === 'string' && diary.text.trim()
    && diary.text.length <= MAX_DIARY && validTime(diary.createdAt)
    && ['pending', 'done', 'failed', 'safety'].includes(diary.status);
}

function validSignal(signal) {
  return typeof signal?.id === 'string' && validDate(signal.date) && CHARACTER_IDS.includes(signal.senderId)
    && typeof signal.message === 'string' && signal.message.trim() && validTime(signal.arrivedAt);
}

// ---------- 채팅 ----------

export function newMessage(role, value, source, now = new Date(), extra = {}) {
  const body = typeof value === 'string' ? value.trim() : '';
  const message = {
    id: `${now.getTime()}-${Math.random().toString(36).slice(2, 10)}`,
    role, text: body, createdAt: now.toISOString(), ...(source ? { source } : {}), ...extra,
  };
  if (!validMessage(message)) throw new Error('보낼 이야기는 1~500자로 적어 주세요.');
  return message;
}

export function welcomeMessage(person, now = new Date()) {
  const address = person.address ? `${person.address}, ` : '';
  const lines = {
    '다정하게': person.casual ? '반가워! 오늘 하루는 어땠어? 작은 일도 들려줘.' : '반가워요! 오늘 하루는 어땠어요? 작은 일도 들려주세요.',
    '차분하게': person.casual ? '반가워. 오늘 마음에 남은 일이 있으면 천천히 들려줘.' : '반가워요. 오늘 마음에 남은 일이 있으면 천천히 들려주세요.',
    '재미있게': person.casual ? '드디어 만났다! 오늘의 소소한 뉴스 있어? 귀 쫑긋하고 있어.' : '드디어 만났네요! 오늘의 소소한 뉴스 있어요? 귀 기울이고 있어요.',
  };
  return newMessage('assistant', address + lines[person.style], 'welcome', now);
}

export function unreadCount(thread, readThrough) {
  const lastRead = thread.findIndex(message => message.id === readThrough);
  return thread.slice(lastRead + 1).filter(message => message.role === 'assistant').length;
}

/** The chat context sent to the model: only this room's back-and-forth, never greetings or diary cards. */
export function conversationContext(thread) {
  let characters = 0;
  const context = [];
  const talk = thread.filter(message => !['welcome', 'diary', 'stage'].includes(message.source));
  for (const message of talk.slice(-CONTEXT_MESSAGES).reverse()) {
    if (characters + message.text.length > CONTEXT_CHARS) break;
    characters += message.text.length;
    context.unshift({ role: message.role, content: message.text });
  }
  while (context[0]?.role === 'assistant') context.shift();
  return context;
}

export function finishOnboarding(user, now = new Date()) {
  const threads = Object.fromEntries(user.characters.map(person => [person.id,
    user.threads[person.id]?.length ? user.threads[person.id] : [welcomeMessage(person, now)]]));
  return { ...user, threads, onboarding: { step: 'done', index: 0, done: [true, true] } };
}

/** Adds a chat reply to the room and the daily-capped affinity gain. */
export function addReply(user, characterId, message, now = new Date()) {
  let next = { ...user, threads: { ...user.threads, [characterId]: [...(user.threads[characterId] ?? []), message] } };
  if (message.source === 'ai') {
    const date = localDate(now);
    const today = user.chatGains[date] ?? {};
    const used = today[characterId] ?? 0;
    if (used < AFFINITY.chatDailyMax) {
      next = { ...gainAffinity(next, characterId, AFFINITY.chat, now), chatGains: { [date]: { ...today, [characterId]: used + 1 } } };
    }
  }
  return next;
}

export function raiseAffinity(affinity, id, amount) {
  return { ...affinity, [id]: clampAffinity((affinity[id] ?? 0) + amount) };
}

export function stageOf(value) {
  const index = STAGES.reduce((found, stage, i) => value >= stage.min ? i : found, 0);
  const next = STAGES[index + 1];
  return { index, name: STAGES[index].name, next: next?.name ?? null, toNext: next ? next.min - value : 0 };
}

/** Raises one heart and, when it reaches a new stage, the character says so in its room. */
export function gainAffinity(user, id, amount, now = new Date()) {
  const before = user.affinity[id] ?? 0;
  const affinity = raiseAffinity(user.affinity, id, amount);
  const stage = stageOf(affinity[id]);
  if (stage.index <= stageOf(before).index) return { ...user, affinity };
  const person = user.characters.find(item => item.id === id);
  const message = newMessage('assistant', stageMessage(person, stage.name), 'stage', now, { stage: stage.name });
  return { ...user, affinity, threads: { ...user.threads, [id]: [...(user.threads[id] ?? []), message] } };
}

function stageMessage(person, name) {
  const address = person?.address ? `${person.address}, ` : '';
  return person?.casual
    ? `${address}요즘 이야기 들려줘서 고마워. 우리 이제 '${name}' 같아!`
    : `${address}요즘 이야기 들려주셔서 고마워요. 우리 이제 '${name}' 같아요!`;
}

// ---------- 일기 ----------

export function diaryFor(user, date = localDate()) {
  return user.diaries.find(item => item.date === date) ?? null;
}

export function diaryErrors({ emoji, text: body }) {
  const errors = {};
  if (!MOODS.some(mood => mood.emoji === emoji)) errors.emoji = '오늘의 감정을 골라 주세요.';
  const value = typeof body === 'string' ? body.trim() : '';
  if (!value) errors.text = '오늘 있었던 일을 적어 주세요.';
  else if (value.length > MAX_DIARY) errors.text = `일기는 ${MAX_DIARY}자까지 적을 수 있어요.`;
  return errors;
}

/** Saves today's diary. Returns { duplicate } when the day already has one (even if deleted). */
export function submitDiary(user, { emoji, text: body }, now = new Date()) {
  const date = localDate(now);
  const errors = diaryErrors({ emoji, text: body });
  if (Object.keys(errors).length) return { errors };
  if (diaryFor(user, date)) return { duplicate: true };
  const kind = category(body);
  const diary = {
    date, emoji, text: body.trim(), createdAt: now.toISOString(), updatedAt: now.toISOString(),
    status: kind === 'safety' ? 'safety' : 'pending', kind, comment: '', reactions: [],
  };
  let next = { ...user, diaries: [diary, ...user.diaries] };
  for (const id of CHARACTER_IDS) next = gainAffinity(next, id, AFFINITY.diary, now);
  if (kind === 'safety') next = applyDiaryResult(next, date, safetyResult(user.characters), now);
  return { user: next, diary: diaryFor(next, date) };
}

export function editDiary(user, { emoji, text: body }, now = new Date()) {
  const date = localDate(now);
  const current = diaryFor(user, date);
  if (!current || current.deleted) return { failed: '오늘 남긴 일기만 수정할 수 있어요.' };
  const errors = diaryErrors({ emoji, text: body });
  if (Object.keys(errors).length) return { errors };
  const kind = category(body);
  const diary = {
    ...current, emoji, text: body.trim(), updatedAt: now.toISOString(), kind,
    status: kind === 'safety' ? 'safety' : 'pending', comment: '', reactions: [],
  };
  let next = { ...user, diaries: user.diaries.map(item => item.date === date ? diary : item) };
  next = removeDiaryMessages(next, date);
  if (kind === 'safety') next = applyDiaryResult(next, date, safetyResult(user.characters), now);
  return { user: next, diary: diaryFor(next, date) };
}

/** Removes the diary, its chat cards and the signal written from it. The day stays used. */
export function deleteDiary(user, date) {
  const current = diaryFor(user, date);
  if (!current || current.deleted) return user;
  const next = removeDiaryMessages(user, date);
  return {
    ...next,
    diaries: next.diaries.map(item => item.date === date ? { date, deleted: true, deletedAt: new Date().toISOString() } : item),
    signals: next.signals.filter(signal => signal.date !== date),
  };
}

function removeDiaryMessages(user, date) {
  const threads = Object.fromEntries(Object.entries(user.threads).map(([id, thread]) =>
    [id, thread.filter(message => !(message.source === 'diary' && message.diaryDate === date))]));
  return { ...user, threads };
}

/** result: { comment, reactions: [first, second], source } */
export function applyDiaryResult(user, date, result, now = new Date()) {
  const diary = diaryFor(user, date);
  if (!diary || diary.deleted) return user;
  const failed = !result;
  const updated = failed
    ? { ...diary, status: 'failed' }
    : { ...diary, status: result.source === 'safety' ? 'safety' : 'done', comment: result.comment, reactions: result.reactions };
  let next = { ...user, diaries: user.diaries.map(item => item.date === date ? updated : item) };
  if (!failed) {
    next = removeDiaryMessages(next, date);
    const threads = { ...next.threads };
    CHARACTER_IDS.forEach((id, index) => {
      threads[id] = [...threads[id], newMessage('assistant', result.reactions[index], 'diary', now, {
        diaryDate: date, emoji: diary.emoji, ...(result.source === 'safety' ? { safety: true } : {}),
      })];
    });
    next = { ...next, threads };
  }
  return next;
}

function safetyResult(characters) {
  return {
    source: 'safety',
    comment: '이야기를 남겨줘서 고마워요. 지금은 안전이 가장 먼저예요. 다칠 위험이 있다면 안전한 곳으로 이동하고, 믿을 만한 사람이나 도움을 줄 수 있는 기관에 지금 상황을 알려 주세요. 긴급한 상황이라면 112나 119, 마음이 힘들 때는 자살예방상담전화 109에서 도움을 받을 수 있어요.',
    reactions: characters.map(person => safetyReply('죽고 싶다', person)),
  };
}

// ---------- 시그널 ----------

export function signalDue(date, now = new Date()) {
  const [y, m, d] = date.split('-').map(Number);
  return now.getTime() >= new Date(y, m - 1, d, SIGNAL_HOUR, 0, 0).getTime();
}

const CHAT_SIGNAL_DAYS = 7;
const isTalk = message => !['welcome', 'diary', 'stage'].includes(message.source) && message.source !== 'safety' && !message.safety;

/** 시그널에 쓸 수 있는 일기: 지우지 않았고 안전 안내로 바뀌지 않은 그날 일기. */
function letterDiary(user, date) {
  const diary = diaryFor(user, date);
  return diary && !diary.deleted && diary.kind !== 'safety' && diary.status !== 'safety' ? diary : null;
}

/** 그 캐릭터와 그날 나눈 대화. 내가 보낸 말이 없거나 위험 신호가 있던 날은 빈 목록. */
function dayChat(user, id, date) {
  const chat = (user.threads[id] ?? []).filter(message => localDate(new Date(message.createdAt)) === date && isTalk(message));
  const mine = chat.filter(message => message.role === 'user');
  return mine.length && !mine.some(message => category(message.text) === 'safety') ? chat : [];
}

/** 위험 신호가 있던 일기 날은 시그널 대신 안전 안내만 남긴다. */
function safetyDay(user, date) {
  const diary = diaryFor(user, date);
  return Boolean(diary && !diary.deleted && (diary.kind === 'safety' || diary.status === 'safety'));
}

/** 시그널을 쓸 재료가 있는 날: 일기가 있거나, 일기가 없어도 그날 대화가 있는 날. */
export function letterSource(user, date) {
  if (safetyDay(user, date)) return null;
  if (letterDiary(user, date)) return 'diary';
  return CHARACTER_IDS.some(id => dayChat(user, id, date).length) ? 'chat' : null;
}

/** Dates ready for a signal: arrived after 22:00, or today when forced by the demo button.
 *  일기가 있는 날은 일기로, 일기 없이 대화만 한 날은 대화로 쓴다 (대화만 한 날은 최근 7일까지). */
export function signalCandidates(user, now = new Date(), force = false) {
  const today = localDate(now);
  const oldest = localDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - CHAT_SIGNAL_DAYS));
  const dates = new Set(user.diaries.map(diary => diary.date));
  for (const id of CHARACTER_IDS) {
    for (const message of user.threads[id] ?? []) {
      const date = localDate(new Date(message.createdAt));
      if (message.role === 'user' && date >= oldest) dates.add(date);
    }
  }
  return [...dates].sort().filter(date => !user.signals.some(signal => signal.date === date)
    && (signalDue(date, now) || (force && date === today))
    && letterSource(user, date) !== null && (letterSource(user, date) === 'diary' || date >= oldest));
}

/** What the AI gets to write a signal: the diary first, and that character's chat on the same day.
 *  일기가 없으면 그날 대화한 캐릭터 중 한 명이 대화 내용으로 쓴다. */
export function prepareSignal(user, date, random = Math.random) {
  const source = letterSource(user, date);
  if (!source) return null;
  const diary = source === 'diary' ? letterDiary(user, date) : null;
  const choices = diary ? CHARACTER_IDS : CHARACTER_IDS.filter(id => dayChat(user, id, date).length);
  const senderId = choices[Math.floor(random() * choices.length)] ?? choices[0];
  const sender = user.characters.find(person => person.id === senderId);
  if (!sender) return null;
  const chat = (user.threads[senderId] ?? []).filter(message => localDate(new Date(message.createdAt)) === date && isTalk(message));
  return {
    date, senderId, sender, source,
    diary: diary ? { emoji: diary.emoji, text: diary.text } : null,
    messages: conversationContext(chat),
  };
}

export function receiveSignal(user, { date, senderId }, message, source = 'ai', now = new Date()) {
  if (user.signals.some(signal => signal.date === date)) return user;
  const signal = {
    id: `signal-${date}`, date, senderId, message: message.trim().slice(0, MAX_REPLY), source,
    arrivedAt: (signalDue(date, now) ? new Date(...dateParts(date), SIGNAL_HOUR) : now).toISOString(),
    read: false, guessId: null, guessedAt: null,
  };
  return { ...user, signals: [signal, ...user.signals].sort((a, b) => b.date.localeCompare(a.date)) };
}

function dateParts(date) {
  const [y, m, d] = date.split('-').map(Number);
  return [y, m - 1, d];
}

export function markSignalRead(user, id) {
  const signal = user.signals.find(item => item.id === id);
  if (!signal || signal.read) return user;
  return { ...user, signals: user.signals.map(item => item.id === id ? { ...item, read: true } : item) };
}

/** One guess per signal. A correct guess raises the sender's heart. */
export function guessSignal(user, id, guessId, now = new Date()) {
  const signal = user.signals.find(item => item.id === id);
  if (!signal || signal.guessId || !CHARACTER_IDS.includes(guessId)) return user;
  const correct = guessId === signal.senderId;
  const next = correct ? gainAffinity(user, signal.senderId, AFFINITY.correctGuess, now) : user;
  return { ...next, signals: next.signals.map(item => item.id === id ? { ...item, read: true, guessId, guessedAt: now.toISOString() } : item) };
}

export function signalPreview(message) {
  const chars = Array.from(message.replace(/\s+/g, ' ').trim());
  return chars.slice(0, 22).join('') + (chars.length > 22 ? '…' : '');
}

/** Used when the AI server cannot write a signal, so the 22:00 letter still arrives. */
export function preparedSignal(sender, diary, messages = []) {
  const address = sender.address ? `${sender.address}, ` : '';
  if (!diary) {
    const said = [...messages].reverse().find(message => message.role === 'user')?.content ?? '';
    const topic = said ? `“${entryExcerpt(said, 30)}”` : '오늘 나눈 이야기';
    const chatLines = {
      '다정하게': sender.casual
        ? `오늘 ${topic}${said ? '라고 들려준 거' : ''} 계속 생각났어. 이야기 나눠줘서 고마워. 오늘 밤은 푹 쉬어.`
        : `오늘 ${topic}${said ? '라고 들려주신 거' : ''} 계속 생각났어요. 이야기 나눠줘서 고마워요. 오늘 밤은 푹 쉬어요.`,
      '차분하게': sender.casual
        ? `오늘 나눈 대화 중에 ${topic}${said ? '라는 말' : ''}이 마음에 남았어. 천천히 하루를 내려놓고 편안한 밤 보내.`
        : `오늘 나눈 대화 중에 ${topic}${said ? '라는 말' : ''}이 마음에 남았어요. 천천히 하루를 내려놓고 편안한 밤 보내세요.`,
      '재미있게': sender.casual
        ? `오늘의 대화 하이라이트! ${topic} 이 얘기 들려줘서 즐거웠어. 굿나잇!`
        : `오늘의 대화 하이라이트! ${topic} 이 얘기 들려줘서 즐거웠어요. 좋은 밤 되세요!`,
    };
    return address + chatLines[sender.style];
  }
  const excerpt = `“${entryExcerpt(diary.text, 30)}”`;
  const lines = {
    '다정하게': sender.casual
      ? `오늘 일기에 ${excerpt}라고 남긴 거 읽었어. 하루를 이렇게 돌아본 것만으로도 충분히 애썼어. 오늘 밤은 푹 쉬어.`
      : `오늘 일기에 ${excerpt}라고 남긴 거 읽었어요. 하루를 이렇게 돌아본 것만으로도 충분히 애썼어요. 오늘 밤은 푹 쉬어요.`,
    '차분하게': sender.casual
      ? `${excerpt} 오늘 이 장면을 기록해 둔 게 좋더라. 천천히 하루를 내려놓고 편안한 밤 보내.`
      : `${excerpt} 오늘 이 장면을 기록해 두신 게 좋았어요. 천천히 하루를 내려놓고 편안한 밤 보내세요.`,
    '재미있게': sender.casual
      ? `오늘의 하이라이트 발견! ${excerpt} 내일의 나도 이 장면 보면 웃을 것 같아. 굿나잇!`
      : `오늘의 하이라이트 발견! ${excerpt} 내일 다시 봐도 웃음이 날 것 같아요. 좋은 밤 되세요!`,
  };
  return address + lines[sender.style];
}

// ---------- 화면 도우미 ----------

export function isNight(now = new Date()) {
  const hour = now.getHours();
  return hour >= SIGNAL_HOUR || hour < 5;
}

export function countdown(date, now = new Date()) {
  const [y, m, d] = date.split('-').map(Number);
  const minutes = Math.max(0, Math.ceil((new Date(y, m - 1, d, SIGNAL_HOUR).getTime() - now.getTime()) / 60_000));
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours}시간 ${minutes % 60}분` : `${minutes}분`;
}

export function greetingFor(now = new Date()) {
  const hour = now.getHours();
  if (hour < 5) return '깊은 밤이에요';
  if (hour < 11) return '좋은 아침이에요';
  if (hour < 17) return '좋은 오후예요';
  if (hour < 22) return '좋은 저녁이에요';
  return '시그널이 오는 밤이에요';
}

/** A short, fixed status line so each character feels present without extra AI calls. */
export function statusLine(person, now = new Date()) {
  const hour = now.getHours();
  const slot = hour < 5 ? 3 : hour < 11 ? 0 : hour < 17 ? 1 : hour < 22 ? 2 : 3;
  const lines = {
    '다정하게': [['아침 햇살 좋다. 오늘도 천천히 가자.', '아침 햇살이 좋네요. 오늘도 천천히 가요.'], ['점심은 챙겨 먹었어?', '점심은 챙겨 드셨어요?'],
      ['오늘 하루 어땠는지 궁금해.', '오늘 하루 어땠는지 궁금해요.'], ['오늘 이야기, 편지에 담는 중.', '오늘 이야기를 편지에 담는 중이에요.']],
    '차분하게': [['차 한 잔 마시는 중.', '차 한 잔 마시는 중이에요.'], ['오후엔 잠깐 쉬어 가도 괜찮아.', '오후엔 잠깐 쉬어 가도 괜찮아요.'],
      ['노을 보면서 하루를 정리하는 중.', '노을 보면서 하루를 정리하는 중이에요.'], ['조용한 밤, 천천히 쓰는 중.', '조용한 밤, 천천히 쓰는 중이에요.']],
    '재미있게': [['오늘의 운세: 작은 일 하나 성공!', '오늘의 운세: 작은 일 하나 성공!'], ['간식 시간이다! 뭐 먹었어?', '간식 시간이에요! 뭐 드셨어요?'],
      ['오늘의 하이라이트 제보 받는 중', '오늘의 하이라이트 제보 받는 중이에요'], ['밤 10시 배달 준비 완료', '밤 10시 배달 준비 완료예요']],
  };
  return lines[person.style][slot][person.casual ? 0 : 1];
}

/** What the setup preview shows for the chosen voice. */
export function sampleLines(person) {
  const greeting = welcomeMessage({ ...person, address: person.address || '' }).text;
  const cheer = {
    '다정하게': person.casual ? '오늘 일기 읽었어. 그 작은 수고, 내가 다 알아봤어.' : '오늘 일기 읽었어요. 그 작은 수고, 제가 다 알아봤어요.',
    '차분하게': person.casual ? '오늘 적은 장면을 천천히 다시 읽어 봤어. 잘 지나왔네.' : '오늘 적은 장면을 천천히 다시 읽어 봤어요. 잘 지나오셨네요.',
    '재미있게': person.casual ? '속보! 오늘의 주인공이 또 해냈다고 합니다 ✨' : '속보예요! 오늘의 주인공이 또 해냈대요 ✨',
  };
  return [greeting, cheer[person.style]];
}

// ---------- 공통 ----------

export function localDate(now = new Date()) {
  const pad = value => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function dateLabel(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })
    .format(new Date(year, month - 1, day, 12));
}

export function category(value) {
  if (/(죽고\s*싶|자살|자해|목숨.{0,10}(끊|버리)|해치고\s*싶|해칠\s*거|학대|폭력을?\s*당|사라지고\s*싶)/u.test(value)) return 'safety';
  if (/(힘들|불안|우울|막막|지쳤|울었|두렵|망했|실패|슬펐|못했|못\s*하|괴롭)/u.test(value)) return 'support';
  return 'ordinary';
}

export function safetyReply(value, character) {
  if (category(value) !== 'safety') return null;
  return character.casual
    ? '이야기해 줘서 고마워. 지금은 안전이 먼저야. 다칠 위험이 있다면 안전한 곳으로 이동하고, 가까운 믿을 만한 사람에게 지금 상황을 알려 도움을 요청해 줘. 긴급하면 112·119, 마음이 힘들 땐 109에 전화할 수 있어.'
    : '이야기해 주셔서 고마워요. 지금은 안전이 먼저예요. 다칠 위험이 있다면 안전한 곳으로 이동하고, 가까운 믿을 만한 사람에게 지금 상황을 알려 도움을 요청해 주세요. 긴급하면 112·119, 마음이 힘들 땐 109에 전화할 수 있어요.';
}

function entryExcerpt(value, max = 40) {
  const chars = Array.from(value.trim().replace(/\s+/g, ' '));
  return chars.slice(0, max).join('') + (chars.length > max ? '…' : '');
}
