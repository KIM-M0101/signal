import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AFFINITY, DEFAULT_CHARACTERS, addReply, applyDiaryResult, characterErrors, cleanCharacter, conversationContext, createAccount,
  currentUser, deleteDiary, diaryFor, editDiary, emptyState, finishOnboarding, guessSignal, login, logout, markSignalRead,
  newMessage, prepareSignal, preparedSignal, profileErrors, readState, receiveSignal, signalCandidates, submitDiary,
  countdown, sampleLines, stageOf, createGuest, isGuest, registerAccount,
} from '../src/model.js';

const day = (h, m = 0, d = 22) => new Date(2026, 10, d, h, m);
const result = { comment: '과제를 10분 시작한 걸 응원해요.', reactions: ['10분 시작한 거 멋져!', '시작하신 10분이 좋았어요.'], source: 'ai' };

function signedIn() {
  const { state } = createAccount(emptyState(), { loginId: 'jiwoo01', password: 'secret12', profile: { nickname: '지우' } });
  const user = finishOnboarding({ ...currentUser(state), characters: DEFAULT_CHARACTERS.map(item => ({ ...item, address: '지우야' })) }, day(9));
  return { state, user };
}

test('accounts stay on this device with a hashed password and resume after logout', () => {
  const created = createAccount(emptyState(), { loginId: 'Jiwoo01', password: 'secret12', profile: { nickname: '지우' } });
  const stored = JSON.stringify(created.state);
  assert.doesNotMatch(stored, /secret12/);
  assert.equal(currentUser(created.state).profile.loginId, 'jiwoo01');
  assert.equal(currentUser(created.state).onboarding.step, 'characters');
  const out = logout(created.state);
  assert.equal(currentUser(out), null);
  assert.equal(login(out, { loginId: 'jiwoo01', password: 'wrong-pass' }).failed, '로그인 정보를 확인해 주세요.');
  assert.ok(login(out, { loginId: '', password: '' }).errors.loginId);
  const back = login(readState(JSON.stringify(out)), { loginId: 'jiwoo01', password: 'secret12' });
  assert.equal(currentUser(back.state).profile.nickname, '지우');
  assert.ok(createAccount(created.state, { loginId: 'jiwoo01', password: 'secret12', profile: {} }).errors.loginId);
});

test('only the name is required in my profile and name+address in each character', () => {
  assert.deepEqual(profileErrors({ nickname: '지우' }), {});
  assert.equal(profileErrors({ nickname: ' ' }).nickname, '이름을 입력해 주세요.');
  const errors = characterErrors({ name: '', address: '' });
  assert.ok(errors.name && errors.address);
  const clean = cleanCharacter({ ...DEFAULT_CHARACTERS[0], relation: '기타', relationCustom: '룸메이트', photo: 'https://x.test/a.png' }, 'first');
  assert.equal(clean.relationCustom, '룸메이트');
  assert.equal(clean.photo, '');
});

test('one diary per local day: duplicates, edits and deletions keep the day used', () => {
  const { user } = signedIn();
  assert.equal(submitDiary(user, { emoji: '', text: '산책했어' }, day(20)).errors.emoji, '오늘의 감정을 골라 주세요.');
  const first = submitDiary(user, { emoji: '🙂', text: '미뤄둔 과제를 10분 시작했어.' }, day(20));
  assert.equal(first.diary.status, 'pending');
  assert.equal(first.user.affinity.first, AFFINITY.diary);
  assert.ok(submitDiary(first.user, { emoji: '😊', text: '또 쓸래' }, day(21)).duplicate);
  const answered = applyDiaryResult(first.user, '2026-11-22', result, day(20, 1));
  assert.equal(diaryFor(answered, '2026-11-22').status, 'done');
  assert.equal(answered.threads.first.at(-1).source, 'diary');
  const edited = editDiary(answered, { emoji: '😊', text: '과제를 20분 했어.' }, day(21));
  assert.equal(edited.diary.status, 'pending');
  assert.equal(edited.user.threads.first.filter(m => m.source === 'diary').length, 0);
  assert.equal(edited.user.affinity.first, AFFINITY.diary);
  const removed = deleteDiary(applyDiaryResult(edited.user, '2026-11-22', result), '2026-11-22');
  assert.ok(diaryFor(removed, '2026-11-22').deleted);
  assert.ok(submitDiary(removed, { emoji: '🙂', text: '다시' }, day(22)).duplicate);
  assert.ok(submitDiary(removed, { emoji: '🙂', text: '다음 날' }, day(9, 0, 23)).user);
});

test('AI failure keeps the saved diary and a risky diary gets the safety guide instead of praise', () => {
  const { user } = signedIn();
  const saved = submitDiary(user, { emoji: '😐', text: '그냥 그런 하루' }, day(20)).user;
  const failed = applyDiaryResult(saved, '2026-11-22', null);
  assert.equal(diaryFor(failed, '2026-11-22').status, 'failed');
  assert.equal(diaryFor(failed, '2026-11-22').text, '그냥 그런 하루');
  const risky = submitDiary(user, { emoji: '😣', text: '죽고 싶다는 생각이 들어' }, day(20));
  assert.equal(risky.diary.status, 'safety');
  assert.match(risky.diary.comment, /안전/);
  assert.ok(risky.diary.reactions.every(text => /안전/.test(text) && !/잘했/.test(text)));
  assert.deepEqual(signalCandidates(risky.user, day(23), true), []);
});

test('chat replies raise each heart by one, at most five a day, and never above 100', () => {
  let { user } = signedIn();
  for (let i = 0; i < 7; i += 1) user = addReply(user, 'first', newMessage('assistant', '좋다!', 'ai', day(12, i)), day(12, i));
  assert.equal(user.affinity.first, AFFINITY.chatDailyMax);
  assert.equal(user.affinity.second, 0);
  user = addReply(user, 'first', newMessage('assistant', '내일도!', 'ai', day(12, 0, 23)), day(12, 0, 23));
  assert.equal(user.affinity.first, AFFINITY.chatDailyMax + 1);
  user = { ...user, affinity: { first: 99, second: 0 } };
  user = guessSignal(receiveSignal(user, { date: '2026-11-22', senderId: 'first' }, '편지'), 'signal-2026-11-22', 'first');
  assert.equal(user.affinity.first, 100);
});

test('signals arrive after 22:00 on a diary day, or earlier with the demo button', () => {
  const { user } = signedIn();
  const withDiary = applyDiaryResult(submitDiary(user, { emoji: '🙂', text: '공원 산책을 했어.' }, day(20)).user, '2026-11-22', result);
  assert.deepEqual(signalCandidates(withDiary, day(21, 59)), []);
  assert.deepEqual(signalCandidates(withDiary, day(21, 59), true), ['2026-11-22']);
  assert.deepEqual(signalCandidates(withDiary, day(22)), ['2026-11-22']);
  const prepared = prepareSignal(withDiary, '2026-11-22', () => 0.9);
  assert.equal(prepared.senderId, 'second');
  assert.equal(prepared.diary.text, '공원 산책을 했어.');
  const received = receiveSignal(withDiary, prepared, preparedSignal(prepared.sender, prepared.diary), 'prepared', day(22, 1));
  assert.equal(received.signals.length, 1);
  assert.equal(received.signals[0].read, false);
  assert.deepEqual(signalCandidates(received, day(23)), []);
  assert.equal(markSignalRead(received, 'signal-2026-11-22').signals[0].read, true);
});

test('a signal takes one guess, a correct guess adds three hearts to the sender', () => {
  const { user } = signedIn();
  const received = receiveSignal(user, { date: '2026-11-22', senderId: 'second' }, '오늘도 수고했어요.');
  const wrong = guessSignal(received, 'signal-2026-11-22', 'first');
  assert.equal(wrong.signals[0].guessId, 'first');
  assert.equal(wrong.affinity.second, 0);
  assert.equal(guessSignal(wrong, 'signal-2026-11-22', 'second'), wrong);
  const right = guessSignal(received, 'signal-2026-11-22', 'second');
  assert.equal(right.affinity.second, AFFINITY.correctGuess);
});

test('saved data reloads intact and chat context skips greetings and diary cards', () => {
  const { state, user } = signedIn();
  let next = addReply({ ...user, threads: { ...user.threads, first: [...user.threads.first, newMessage('user', '산책했어', undefined, day(12))] } },
    'first', newMessage('assistant', '좋았겠다!', 'ai', day(12, 1)), day(12, 1));
  next = applyDiaryResult(submitDiary(next, { emoji: '😊', text: '좋은 하루' }, day(20)).user, '2026-11-22', result);
  const reloaded = currentUser(readState(JSON.stringify({ ...state, users: { [state.sessionId]: next } })));
  assert.equal(reloaded.threads.first.length, 4);
  assert.deepEqual(conversationContext(reloaded.threads.first), [
    { role: 'user', content: '산책했어' }, { role: 'assistant', content: '좋았겠다!' },
  ]);
  const pending = submitDiary(user, { emoji: '😊', text: '저장 중' }, day(20)).user;
  const restored = currentUser(readState(JSON.stringify({ ...state, users: { [state.sessionId]: pending } })));
  assert.equal(diaryFor(restored, '2026-11-22').status, 'failed');
});

test('the account is created last and carries the drafted profile and both characters', () => {
  const characters = DEFAULT_CHARACTERS.map((item, i) => ({ ...item, address: i ? '지우 님' : '지우야' }));
  const { state } = createAccount(emptyState(), { loginId: 'jiwoo02', password: 'secret12', profile: { nickname: '지우' }, characters });
  const user = currentUser(state);
  assert.equal(user.onboarding.step, 'done');
  assert.equal(user.characters[1].address, '지우 님');
  assert.equal(user.threads.first[0].source, 'welcome');
  const partial = createAccount(emptyState(), { loginId: 'jiwoo03', password: 'secret12', profile: { nickname: '지우' },
    characters: [characters[0], { ...characters[1], address: '' }] });
  assert.equal(currentUser(partial.state).onboarding.step, 'characters');
});

test('reaching a new heart stage adds one gentle message in that room, never a drop', () => {
  let { user } = signedIn();
  user = { ...user, affinity: { first: 18, second: 0 } };
  user = submitDiary(user, { emoji: '😊', text: '좋은 하루' }, day(20)).user;
  const stage = user.threads.first.filter(m => m.source === 'stage');
  assert.equal(stage.length, 1);
  assert.equal(stage[0].stage, '편한 사이');
  assert.equal(stageOf(user.affinity.first).name, '편한 사이');
  assert.equal(user.threads.second.filter(m => m.source === 'stage').length, 0);
  assert.deepEqual(conversationContext(user.threads.first), []);
  assert.match(sampleLines({ ...DEFAULT_CHARACTERS[1], address: '지우 님' })[0], /요/);
  assert.equal(countdown('2026-11-22', day(19, 30)), '2시간 30분');
});

test('a guest can use everything now and add a login later without losing records', () => {
  const characters = DEFAULT_CHARACTERS.map((item, i) => ({ ...item, address: i ? '지우 님' : '지우야' }));
  const { state } = createGuest(emptyState(), { profile: { nickname: '지우' }, characters });
  assert.equal(isGuest(state), true);
  const guestUser = submitDiary(currentUser(state), { emoji: '🙂', text: '산책했어' }, day(20)).user;
  const withDiary = { ...state, users: { [state.sessionId]: guestUser } };
  const reloaded = readState(JSON.stringify(withDiary));
  assert.equal(isGuest(reloaded), true);
  assert.equal(currentUser(reloaded).onboarding.step, 'done');
  assert.equal(login(logout(reloaded), { loginId: '', password: '' }).errors.loginId, '아이디를 입력해 주세요.');
  assert.ok(registerAccount(reloaded, { loginId: 'ab', password: 'secret12' }).errors.loginId);
  const { state: registered } = registerAccount(reloaded, { loginId: 'jiwoo05', password: 'secret12' });
  assert.equal(isGuest(registered), false);
  assert.equal(currentUser(registered).diaries.length, 1);
  assert.equal(currentUser(registered).profile.loginId, 'jiwoo05');
  const back = login(logout(registered), { loginId: 'jiwoo05', password: 'secret12' });
  assert.equal(currentUser(back.state).diaries[0].text, '산책했어');
  assert.equal(registerAccount(registered, { loginId: 'other01', password: 'secret12' }).failed, '이미 로그인 계정이 있어요.');
});
