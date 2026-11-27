import React, { useEffect, useRef, useState } from 'react';
import { BackHandler, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useFonts } from 'expo-font';
import { chatStatus, getDiaryResult, getReply, getSignal } from './src/chat-api.js';
import { cancelAllSignalNotices, cancelSignalNotice, scheduleSignalNotice } from './src/notify.js';
import {
  CHARACTER_IDS, DEFAULT_CHARACTERS, DEFAULT_PROFILE, MAX_PHOTO, countdown, createGuest, emptyPending, isGuest, registerAccount, STORAGE_KEY, addReply, applyDiaryResult, characterErrors,
  checkAccountInput, cleanCharacter, cleanProfile, createAccount, currentUser, deleteAccount, deleteDiary, diaryFor, editDiary,
  emptyState, finishOnboarding, josa, guessSignal, letterSource, localDate, login, logout, markSignalRead, newMessage, prepareSignal,
  preparedSignal, profileErrors, readState, receiveSignal, safetyReply, signalCandidates, signalDue, submitDiary, updateUser,
} from './src/model.js';
import {
  AccountForm, BazeConsent, CharacterSetup, Chat, Confirm, Diaries, DiaryResult, DiaryWrite, GuessResult, Home, Intro, Loading, Login,
  Notice, Action, Privacy, ProfileForm, SenderPick, Settings, SignalArchive, SignalDetail, Tabs, BackgroundContext,
} from './src/screens.js';
import { backgroundOf, styles as s } from './src/theme.js';

const TAB_ROUTES = ['house', 'diaries', 'signals', 'settings'];

function HaruSignal() {
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [route, setRoute] = useState('loading');
  const [params, setParams] = useState({});
  const [profileDraft, setProfileDraft] = useState(DEFAULT_PROFILE);
  const [characterDraft, setCharacterDraft] = useState(null);
  const [diaryDraft, setDiaryDraft] = useState({ emoji: '', text: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [drafts, setDrafts] = useState({});
  const [chatErrors, setChatErrors] = useState({});
  const [pending, setPending] = useState({});
  const [generating, setGenerating] = useState(false);
  const [signalBusy, setSignalBusy] = useState(false);
  const [signalError, setSignalError] = useState('');
  const [connection, setConnection] = useState({ available: null, provider: null });
  const [bazeConsent, setBazeConsent] = useState(false);
  const [bazeNotice, setBazeNotice] = useState(false);
  const [bazeUsage, setBazeUsage] = useState({});
  const [dialog, setDialog] = useState(null);
  const [now, setNow] = useState(() => new Date());
  const [freshDiary, setFreshDiary] = useState(null);
  const [fontsLoaded, fontError] = useFonts({
    'Pretendard-Regular': require('./assets/fonts/Pretendard-Regular.otf'),
    'Pretendard-SemiBold': require('./assets/fonts/Pretendard-SemiBold.otf'),
    'Pretendard-Bold': require('./assets/fonts/Pretendard-Bold.otf'),
  });
  const fontsReady = fontsLoaded || Boolean(fontError);
  const working = useRef(false);
  const requesting = useRef(new Set());
  const delivering = useRef(false);
  const dataRef = useRef(null);
  const writeQueue = useRef(Promise.resolve());
  const scroll = useRef(null);
  const backTo = useRef({});

  const user = data ? currentUser(data) : null;
  const ready = user?.onboarding.step === 'done';
  const guest = data ? isGuest(data) : false;
  const today = localDate(now);
  const todayDiary = user ? diaryFor(user, today) : null;
  const unreadSignals = user ? user.signals.filter(signal => !signal.read).length : 0;

  function updateData(next) {
    dataRef.current = next;
    setData(next);
  }

  async function load() {
    setLoadError('');
    try {
      const saved = readState(await AsyncStorage.getItem(STORAGE_KEY));
      updateData(saved);
      const signedIn = currentUser(saved);
      setRoute(!signedIn ? 'intro' : signedIn.onboarding.step === 'done' ? 'house' : 'characters');
    } catch {
      setLoadError('메시지를 불러오지 못했어요. 다시 시도해 주세요.');
      setRoute('intro');
    }
  }

  function save(change) {
    const update = writeQueue.current.then(async () => {
      const current = dataRef.current;
      const next = change(current);
      if (next === current) return current;
      try { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)); }
      catch { throw new Error('이 기기에 저장하지 못했어요. 저장 공간을 확인하고 다시 시도해 주세요.'); }
      updateData(next);
      return next;
    });
    writeQueue.current = update.catch(() => {});
    return update;
  }
  const saveUser = change => save(current => updateUser(current, change));

  useEffect(() => { void load(); }, []);
  useEffect(() => { scroll.current?.scrollTo({ y: 0, animated: false }); }, [route, params.index]);
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!ready) return undefined;
    let active = true;
    const check = async () => {
      const status = await chatStatus();
      if (active) setConnection(current => ({ ...status, provider: status.provider ?? current.provider }));
    };
    void check();
    const timer = setInterval(check, 10_000);
    return () => { active = false; clearInterval(timer); };
  }, [ready]);
  // 밤 10시가 지나면 그날 일기(없으면 대화)로 시그널을 한 통 보낸다.
  useEffect(() => {
    if (ready && user && signalCandidates(user, now).length) void deliverSignals(false);
  }, [ready, now, data?.sessionId, user?.diaries, user?.threads]);
  // 채팅방을 보고 있으면 읽음 처리
  const room = route === 'chat' ? params.id : null;
  const roomLast = room ? user?.threads[room]?.at(-1)?.id : null;
  useEffect(() => {
    if (!room || !roomLast || user.readThrough[room] === roomLast) return;
    void saveUser(current => ({ ...current, readThrough: { ...current.readThrough, [room]: roomLast } })).catch(() => {});
  }, [room, roomLast]);
  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      if (working.current) return true;
      const target = backTarget();
      if (!target) return false;
      target();
      return true;
    });
    return () => back.remove();
  });

  function go(next, nextParams = {}) {
    setError('');
    setErrors({});
    setParams(nextParams);
    setRoute(next);
  }

  async function perform(action) {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError('');
    try { await action(); }
    catch (failure) { setError(failure.message || '잠시 뒤 다시 시도해 주세요.'); }
    finally { working.current = false; setBusy(false); }
  }

  function backTarget() {
    if (route === 'login' || route === 'privacy' && !user) return () => go('intro');
    if (route === 'privacy') return () => go('settings');
    if (route === 'profile') return () => exitProfile();
    if (route === 'characters') return () => exitCharacters();
    if (['chat', 'diaryWrite', 'diaries', 'signals', 'settings'].includes(route) && ready) return () => go('house');
    if (route === 'diaryResult') return () => go(backTo.current.diary ?? 'house');
    if (route === 'account') return () => exitAccount();
    if (route === 'signalDetail') return () => go('signals');
    if (route === 'senderPick') return () => go('signalDetail', params);
    if (route === 'guessResult') return () => go('signals');
    return null;
  }

  // ---------- 온보딩 ----------
  // 계정이 없을 때는 프로필·캐릭터 초안을 pending에 저장하고, 마지막 단계에서 계정을 만든다.

  const savePending = change => save(current => ({ ...current, pending: change(current.pending ?? emptyPending()) }));

  function startFresh(resume = false) {
    const pending = resume && data.pending ? data.pending : emptyPending();
    setProfileDraft({ ...DEFAULT_PROFILE, ...pending.profile });
    if (!resume) void save(current => ({ ...current, pending })).catch(() => {});
    if (resume && pending.step === 'characters') go('characters', { index: pending.index });
    else if (resume && pending.step === 'account') go('account');
    else go('profile', { mode: 'onboarding' });
  }

  function changeProfile(update) {
    setProfileDraft(current => {
      const next = { ...current, ...update };
      if (params.mode === 'onboarding') void savePending(pending => ({ ...pending, profile: cleanProfile(next) })).catch(() => {});
      return next;
    });
    setErrors(current => Object.fromEntries(Object.entries(current).filter(([key]) => !(key in update))));
  }

  function exitProfile() {
    if (params.mode === 'onboarding') go('intro');
    else if (params.mode === 'resume') go('characters', { index: 0 });
    else go('settings');
  }

  function submitProfile() {
    void perform(async () => {
      const found = profileErrors(profileDraft);
      if (Object.keys(found).length) { setErrors(found); throw new Error(found.nickname); }
      if (params.mode === 'onboarding') {
        const saved = await savePending(pending => ({ ...pending, profile: cleanProfile(profileDraft), step: 'characters' }));
        go('characters', { index: saved.pending.index });
        return;
      }
      await saveUser(current => ({ ...current, profile: { ...cleanProfile(profileDraft), loginId: current.profile.loginId } }));
      if (params.mode === 'resume') go('characters', { index: 0 });
      else go('settings');
    });
  }

  function editProfile(mode = 'edit') {
    setProfileDraft({ ...user.profile });
    go('profile', { mode });
  }

  function submitAccount(input) {
    if (params.register) {
      void perform(async () => {
        let result;
        await save(current => { result = registerAccount(current, input); return result.state ?? current; });
        if (result.errors) { setErrors(result.errors); throw new Error(result.errors.loginId ?? result.errors.password); }
        if (result.failed) throw new Error(result.failed);
        go('settings', { notice: '로그인 계정을 만들었어요. 이제 로그아웃해도 이 아이디로 다시 들어올 수 있어요.' });
      });
      return;
    }
    void perform(async () => {
      let result;
      await save(current => {
        const pending = current.pending ?? emptyPending();
        result = createAccount(current, { ...input, profile: pending.profile, characters: pending.characters });
        return result.state ?? current;
      });
      if (result.errors) { setErrors(result.errors); throw new Error(result.errors.loginId ?? result.errors.password); }
      setBazeConsent(false);
      go(currentUser(dataRef.current).onboarding.step === 'done' ? 'house' : 'characters', { index: 0 });
    });
  }

  function startAsGuest() {
    void perform(async () => {
      await save(current => {
        const pending = current.pending ?? emptyPending();
        return createGuest(current, { profile: pending.profile, characters: pending.characters }).state;
      });
      setBazeConsent(false);
      go(currentUser(dataRef.current).onboarding.step === 'done' ? 'house' : 'characters', { index: 0 });
    });
  }

  // ---------- 캐릭터 ----------
  // source: 계정 전(pending), 로그인 후 다시 설정(user.onboarding), 설정에서 수정(characterDraft)

  const characterMode = route !== 'characters' ? null : params.editing ? 'edit' : user ? 'user' : 'pending';
  const characterList = characterMode === 'edit' ? characterDraft : characterMode === 'user' ? user?.characters
    : characterMode === 'pending' ? data?.pending?.characters ?? emptyPending().characters : null;
  const characterDone = characterMode === 'edit' ? [true, true] : characterMode === 'user' ? user?.onboarding.done
    : data?.pending?.done ?? [false, false];
  const characterIndex = params.index ?? 0;

  function editCharacter(index, from = 'settings') {
    setCharacterDraft(user.characters.map(item => ({ ...item })));
    go('characters', { index, editing: true, from });
  }

  function changeCharacter(update) {
    const index = characterIndex;
    setErrors(current => Object.fromEntries(Object.entries(current).filter(([key]) => !(key in update))));
    const patch = list => list.map((item, i) => i === index ? { ...item, ...update } : item);
    const undone = done => done.map((value, i) => i === index ? false : value);
    if (characterMode === 'edit') setCharacterDraft(patch);
    else if (characterMode === 'user') {
      void saveUser(current => ({ ...current, characters: patch(current.characters),
        onboarding: { ...current.onboarding, index, done: undone(current.onboarding.done) } })).catch(failure => setError(failure.message));
    } else {
      void savePending(pending => ({ ...pending, index, characters: patch(pending.characters), done: undone(pending.done) }))
        .catch(failure => setError(failure.message));
    }
  }

  async function pickPhoto() {
    await perform(async () => {
      let result;
      try { result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], base64: true, quality: 0.55, exif: false }); }
      catch { throw new Error('사진 선택을 열지 못했어요. 기본 아바타를 고를 수 있어요.'); }
      if (result.canceled) return;
      const base64 = result.assets[0]?.base64;
      const mime = base64?.startsWith('iVBOR') ? 'png' : base64?.startsWith('/9j/') ? 'jpeg' : '';
      if (!mime) throw new Error('JPG 또는 PNG 이미지를 골라 주세요.');
      const photo = 'data:image/' + mime + ';base64,' + base64;
      if (photo.length > MAX_PHOTO) throw new Error('이미지가 너무 커요. 더 작은 이미지를 골라 주세요.');
      changeCharacter({ photo });
    });
  }

  function completeCharacter() {
    void perform(async () => {
      const index = characterIndex;
      const person = characterList[index];
      const found = characterErrors(person);
      if (Object.keys(found).length) { setErrors(found); throw new Error('필수 항목을 입력해 주세요.'); }
      const clean = cleanCharacter(person, CHARACTER_IDS[index]);
      const swap = list => list.map((item, i) => i === index ? clean : item);
      if (characterMode === 'edit') {
        await saveUser(current => ({ ...current, characters: swap(current.characters) }));
        go(params.from === 'chat' ? 'chat' : 'settings', params.from === 'chat' ? { id: clean.id } : {});
        return;
      }
      let next = index;
      const step = done => {
        const marked = done.map((value, i) => i === index ? true : value);
        next = marked[1 - index] ? index : 1 - index;
        return marked;
      };
      if (characterMode === 'user') {
        await saveUser(current => {
          const done = step(current.onboarding.done);
          return { ...current, characters: swap(current.characters), onboarding: { ...current.onboarding, done, index: next } };
        });
      } else {
        await savePending(pending => {
          const done = step(pending.done);
          return { ...pending, characters: swap(pending.characters), done, index: next };
        });
      }
      setErrors({});
      setParams({ ...params, index: next });
    });
  }

  function finishCharacters() {
    void perform(async () => {
      if (!characterDone.every(Boolean)) throw new Error('두 캐릭터 프로필을 모두 완료해 주세요.');
      if (characterMode === 'user') {
        await saveUser(current => finishOnboarding(current));
        go('house');
      } else {
        await savePending(pending => ({ ...pending, step: 'account' }));
        go('account');
      }
    });
  }

  function exitCharacters() {
    if (characterMode === 'edit') { go(params.from === 'chat' ? 'chat' : 'settings', params.from === 'chat' ? { id: CHARACTER_IDS[characterIndex] } : {}); return; }
    if (characterIndex === 1) { setParams({ ...params, index: 0 }); setErrors({}); return; }
    if (characterMode === 'user') { editProfile('resume'); return; }
    void savePending(pending => ({ ...pending, step: 'profile' })).catch(() => {});
    setProfileDraft({ ...DEFAULT_PROFILE, ...data.pending?.profile });
    go('profile', { mode: 'onboarding' });
  }

  function exitAccount() {
    if (params.register) { go(params.from === 'profile' ? 'profile' : 'settings', params.from === 'profile' ? { mode: 'edit' } : {}); return; }
    void savePending(pending => ({ ...pending, step: 'characters' })).catch(() => {});
    go('characters', { index: 1 });
  }

  // ---------- 로그인 ----------

  function submitLogin(input) {
    void perform(async () => {
      let result;
      await save(current => { result = login(current, input); return result.state ?? current; });
      if (result.errors) { setErrors(result.errors); return; }
      if (result.failed) { setErrors({ failed: result.failed }); return; }
      const signed = currentUser(dataRef.current);
      setErrors({});
      setBazeConsent(false);
      go(signed.onboarding.step === 'done' ? 'house' : 'characters', { index: signed.onboarding.index });
    });
  }

  // ---------- 채팅 ----------

  async function send(character, value, retryId) {
    const body = value.trim();
    const id = character.id;
    if (!body || requesting.current.has(id)) return;
    const safe = safetyReply(body, character);
    if (!safe && connection.provider === 'baze' && !bazeConsent) { setBazeNotice(true); return; }
    requesting.current.add(id);
    setPending(current => ({ ...current, [id]: true }));
    setChatErrors(current => ({ ...current, [id]: '' }));
    try {
      let thread = currentUser(dataRef.current).threads[id] ?? [];
      if (retryId) {
        const talk = thread.filter(message => message.source !== 'diary');
        if (talk.at(-1)?.id !== retryId || talk.at(-1)?.role !== 'user') return;
      } else {
        const message = newMessage('user', body);
        const saved = await saveUser(current => ({ ...current, threads: { ...current.threads, [id]: [...current.threads[id], message] } }));
        thread = currentUser(saved).threads[id];
        void scheduleSignalNotice(localDate());
        setDrafts(current => current[id]?.trim() === body ? { ...current, [id]: '' } : current);
      }
      const result = safe ? { reply: safe, source: 'safety' } : await getReply(character, currentUser(dataRef.current).profile, thread, bazeConsent);
      await saveUser(current => addReply(current, id, newMessage('assistant', result.reply, result.source)));
      if (result.usage) setBazeUsage(current => ({ ...current, [id]: result.usage }));
    } catch (failure) {
      setChatErrors(current => ({ ...current, [id]: failure.message || '답장을 받지 못했어요.' }));
    } finally {
      requesting.current.delete(id);
      setPending(current => ({ ...current, [id]: false }));
    }
  }

  // ---------- 일기 ----------

  function openDiary(origin = route) {
    backTo.current.diary = TAB_ROUTES.includes(origin) ? origin : 'house';
    if (todayDiary) go('diaryResult', { date: today });
    else { setDiaryDraft({ emoji: '', text: '' }); go('diaryWrite'); }
  }

  function openDiaryResult(date) {
    backTo.current.diary = route === 'chat' ? 'house' : TAB_ROUTES.includes(route) ? route : 'house';
    go('diaryResult', { date });
  }

  async function generateDiary(date) {
    const current = currentUser(dataRef.current);
    const diary = diaryFor(current, date);
    if (!diary || diary.deleted || diary.status === 'safety') return;
    setGenerating(true);
    setError('');
    try {
      const result = await getDiaryResult(current.characters, current.profile, diary, bazeConsent);
      await saveUser(state => applyDiaryResult(state, date, result));
      setFreshDiary(date);
    } catch (failure) {
      setError(failure.message);
      await saveUser(state => applyDiaryResult(state, date, null)).catch(() => {});
    } finally {
      setGenerating(false);
    }
  }

  function writeDiary() {
    if (connection.provider === 'baze' && !bazeConsent) { setBazeNotice(true); return; }
    const editing = params.editing;
    void perform(async () => {
      let result;
      await saveUser(current => {
        result = editing ? editDiary(current, diaryDraft) : submitDiary(current, diaryDraft);
        return result.user ?? current;
      });
      if (result.errors) { setErrors(result.errors); throw new Error(result.errors.emoji ?? result.errors.text); }
      if (result.duplicate) {
        setParams({ date: today, notice: '오늘 남긴 일기가 있어요. 기존 기록을 확인해 주세요.' });
        setRoute('diaryResult');
        return;
      }
      if (result.failed) throw new Error(result.failed);
      setErrors({});
      setParams({ date: today });
      setRoute('diaryResult');
      if (result.diary.status === 'pending') void generateDiary(today);
      if (result.diary.kind !== 'safety') void scheduleSignalNotice(today);
      else void cancelSignalNotice(today);
    }).catch(() => {});
  }

  function startEditDiary() {
    const diary = diaryFor(user, today);
    setDiaryDraft({ emoji: diary.emoji, text: diary.text });
    go('diaryWrite', { editing: true });
  }

  // ---------- 시그널 ----------

  async function deliverSignals(force) {
    if (delivering.current) return;
    delivering.current = true;
    if (force) { setSignalBusy(true); setSignalError(''); }
    try {
      const current = currentUser(dataRef.current);
      for (const date of signalCandidates(current, new Date(), force)) {
        const prepared = prepareSignal(currentUser(dataRef.current), date);
        if (!prepared) continue;
        let message;
        let source = 'ai';
        const canUseAi = connection.provider !== 'baze' || bazeConsent;
        try {
          if (!canUseAi) throw new Error('consent');
          message = await getSignal(prepared, current.profile, bazeConsent);
        } catch {
          message = preparedSignal(prepared.sender, prepared.diary, prepared.messages);
          source = 'prepared';
        }
        await saveUser(state => receiveSignal(state, prepared, message, source));
      }
    } catch (failure) {
      if (force) setSignalError(failure.message || '시그널을 받지 못했어요. 다시 시도해 주세요.');
    } finally {
      delivering.current = false;
      if (force) setSignalBusy(false);
    }
  }

  function openSignal(id) {
    go('signalDetail', { id });
  }

  function submitGuess(guessId) {
    const id = params.id;
    void perform(async () => {
      const signal = currentUser(dataRef.current).signals.find(item => item.id === id);
      if (signal?.guessId) { go('guessResult', { id }); return; }
      try { await saveUser(current => guessSignal(current, id, guessId)); }
      catch { throw new Error('선택 결과를 저장하지 못했어요. 다시 시도해 주세요.'); }
      setParams({ id });
      setRoute('guessResult');
    });
  }

  // ---------- 삭제·로그아웃 ----------

  function askRemove({ type, index, date }) {
    setError('');
    const name = type === 'character' ? user.characters[index].name : '';
    const dialogs = {
      diary: { title: '오늘 일기를 삭제할까요?', body: '일기와 AI 총평, 채팅방의 일기 반응, 이 일기로 받은 시그널을 지워요. 삭제한 뒤에도 오늘은 새 일기를 쓸 수 없어요.' },
      records: { title: '기록을 삭제할까요?', body: '두 채팅방의 대화, 모든 일기, 받은 시그널을 이 기기에서 지워요. 내 프로필과 캐릭터 설정, 호감도는 남아요.' },
      character: { title: `${name} 프로필을 삭제할까요?`, body: `${name}의 설정과 사진, 채팅, 호감도, ${josa(name, '이', '가')} 보낸 시그널을 지워요. 삭제 후에는 새 캐릭터를 설정해야 채팅방을 쓸 수 있어요.` },
      account: { title: '계정과 내 프로필을 삭제할까요?', body: '로그인 계정, 내 프로필, 두 캐릭터, 모든 일기와 채팅, 시그널을 이 기기에서 지워요. 되돌릴 수 없어요.' },
    };
    setDialog({ ...dialogs[type], type, index, date });
  }

  function confirmRemove() {
    void perform(async () => {
      if (requesting.current.size || generating) throw new Error('답장이 끝난 뒤에 삭제할 수 있어요.');
      const { type, index, date } = dialog;
      if (type === 'diary') {
        await saveUser(current => deleteDiary(current, date));
        void cancelSignalNotice(date);
        setDialog(null);
        go('diaries');
        return;
      }
      if (type === 'records') {
        await saveUser(current => ({ ...current, threads: { first: [], second: [] }, readThrough: { first: '', second: '' },
          diaries: [], signals: [], chatGains: {} }));
        void cancelAllSignalNotices();
        await saveUser(current => finishOnboarding(current));
        setDialog(null);
        go('house');
      } else if (type === 'character') {
        const id = CHARACTER_IDS[index];
        await saveUser(current => ({
          ...current,
          characters: current.characters.map((item, i) => i === index ? { ...DEFAULT_CHARACTERS[i], name: '', address: '' } : item),
          threads: { ...current.threads, [id]: [] }, readThrough: { ...current.readThrough, [id]: '' },
          affinity: { ...current.affinity, [id]: 0 },
          signals: current.signals.filter(signal => signal.senderId !== id),
          onboarding: { step: 'characters', index, done: current.onboarding.done.map((value, i) => i === index ? false : value) },
        }));
        setDialog(null);
        go('characters', { index });
      } else {
        await save(current => deleteAccount(current, current.sessionId));
        void cancelAllSignalNotices();
        setDialog(null);
        setBazeConsent(false);
        go('intro', { notice: '계정과 모든 기록을 이 기기에서 삭제했어요.' });
      }
      setDrafts({});
      setChatErrors({});
    });
  }

  function signOut() {
    if (isGuest(dataRef.current)) return;
    void perform(async () => {
      await save(current => logout(current));
      void cancelAllSignalNotices();
      setBazeConsent(false);
      setDrafts({});
      go('intro');
    });
  }

  // ---------- 화면 ----------

  const signal = user?.signals.find(item => item.id === params.id);
  const todaySource = user ? letterSource(user, today) : null;
  const canTestSignal = Boolean(todaySource && !user.signals.some(item => item.date === today));
  const waiting = canTestSignal && !signalDue(today, now);
  const tab = TAB_ROUTES.includes(route) ? route : route === 'chat' ? 'house'
    : ['signalDetail', 'senderPick', 'guessResult'].includes(route) ? 'signals' : route.startsWith('diary') ? 'diaries' : null;
  const showTabs = ready && TAB_ROUTES.includes(route);
  const person = route === 'chat' ? user?.characters.find(item => item.id === params.id) : null;

  const todaySignal = user?.signals.find(item => item.date === today) ?? null;
  const pendingStarted = Boolean(data?.pending && (data.pending.step !== 'profile' || data.pending.profile.nickname));

  let body;
  if (route === 'loading' || !data || !fontsReady) body = <Loading>메시지를 불러오고 있어요.</Loading>;
  else if (loadError && !user) body = <View style={s.recovery}><Notice danger>{loadError}</Notice>
    <Action onPress={() => void load()}>다시 시도</Action>
    <Action kind="soft" onPress={() => void perform(async () => { await AsyncStorage.removeItem(STORAGE_KEY); updateData(emptyState()); setLoadError(''); })}>
      저장 데이터 초기화</Action></View>;
  else if (route === 'intro') body = <Intro notice={params.notice} hasPending={pendingStarted} onStart={() => startFresh(false)}
    onResume={() => startFresh(true)} onLogin={() => go('login')} onPrivacy={() => go('privacy')} />;
  else if (route === 'privacy') body = <Privacy provider={connection.provider} onBack={() => go(user ? 'settings' : 'intro')} />;
  else if (route === 'login') body = <Login onSubmit={submitLogin} onBack={() => go('intro')} onStart={() => startFresh(false)}
    errors={errors} failed={errors.failed} busy={busy} />;
  else if (route === 'profile') body = <ProfileForm value={profileDraft} onChange={changeProfile} onNext={submitProfile} onBack={exitProfile}
    errors={errors} busy={busy} editing={params.mode !== 'onboarding'} error={error}
    guest={guest} onRegister={() => go('account', { register: true, from: 'profile' })} />;
  else if (route === 'characters' && characterList) body = <CharacterSetup draft={characterList} index={characterIndex}
    done={characterDone} editing={characterMode === 'edit'} onboarding={characterMode === 'pending'}
    finishLabel={characterMode === 'pending' ? '다음: 계정 만들기' : '채팅방으로'}
    onChoose={index => { setErrors({}); setParams({ ...params, index }); }} onChange={changeCharacter} onPickPhoto={pickPhoto}
    onComplete={completeCharacter} onFinish={finishCharacters} onBack={exitCharacters} busy={busy} errors={errors} error={error} />;
  else if (route === 'account' && (!user || (params.register && guest))) body = <AccountForm register={Boolean(params.register)}
    characters={params.register ? user.characters : data.pending?.characters ?? emptyPending().characters}
    onSubmit={submitAccount} onGuest={startAsGuest} onBack={exitAccount} errors={errors} busy={busy} error={error && !errors.loginId && !errors.password ? error : ''} />;
  else if (!user) body = <Loading>로그인 정보를 확인하고 있어요.</Loading>;
  else if (!ready) body = <Loading>캐릭터 설정을 확인하고 있어요.</Loading>;
  else if (route === 'house') body = <Home profile={user.profile} characters={user.characters} affinity={user.affinity} threads={user.threads}
    readThrough={user.readThrough} todayDiary={todayDiary} todaySignal={todaySignal} now={now}
    onOpenRoom={id => go('chat', { id })} onDiary={() => openDiary('house')} onSignals={() => go('signals')}
    onOpenSignal={openSignal} onSettings={() => go('settings')} />;
  else if (route === 'diaryWrite') body = <DiaryWrite date={today} value={diaryDraft} editing={params.editing}
    onChange={update => { setDiaryDraft(current => ({ ...current, ...update })); setErrors(current => ({ ...current, ...Object.fromEntries(Object.keys(update).map(key => [key, undefined])) })); }}
    onSubmit={writeDiary} onBack={() => go(params.editing ? 'diaryResult' : 'house', params.editing ? { date: today } : {})}
    errors={errors} busy={busy} error={error && !errors.emoji && !errors.text ? error : ''} />;
  else if (route === 'diaryResult' && diaryFor(user, params.date)) body = <>
    {params.notice ? <View style={s.content}><Notice>{params.notice}</Notice></View> : null}
    <DiaryResult key={`${params.date}-${diaryFor(user, params.date).updatedAt}`} diary={diaryFor(user, params.date)} characters={user.characters}
      generating={generating && params.date === today} fresh={freshDiary === params.date}
      isToday={params.date === today} error={error} onBack={() => go(backTo.current.diary ?? 'house')} onChat={() => go('house')}
      onEdit={startEditDiary} onDelete={() => askRemove({ type: 'diary', date: params.date })}
      onRetry={() => void generateDiary(params.date)} /></>;
  else if (route === 'diaries') body = <Diaries diaries={user.diaries} today={today} onOpen={openDiaryResult} onWrite={() => openDiary('diaries')} />;
  else if (route === 'signals') body = <SignalArchive signals={user.signals} characters={user.characters} onOpen={openSignal}
    onChat={() => go('house')} canTest={canTestSignal} waitingFor={waiting ? countdown(today, now) : ''} testing={signalBusy} error={signalError}
    onTest={() => { if (connection.provider === 'baze' && !bazeConsent) setBazeNotice(true); else void deliverSignals(true); }} />;
  else if (route === 'signalDetail' && signal) body = <SignalDetail key={signal.id} signal={signal} characters={user.characters}
    onOpenEnvelope={() => void saveUser(current => markSignalRead(current, signal.id)).catch(() => {})}
    onGuess={() => go('senderPick', { id: signal.id })} onResult={() => go('guessResult', { id: signal.id })} onBack={() => go('signals')} />;
  else if (route === 'senderPick' && signal) body = signal.guessId
    ? <GuessResult signal={signal} characters={user.characters} affinity={user.affinity} onArchive={() => go('signals')} onChat={() => go('house')} />
    : <SenderPick signal={signal} characters={user.characters} onSubmit={submitGuess} onBack={() => go('signalDetail', { id: signal.id })} busy={busy} error={error} />;
  else if (route === 'guessResult' && signal?.guessId) body = <GuessResult signal={signal} characters={user.characters} affinity={user.affinity}
    onArchive={() => go('signals')} onChat={() => go('house')} />;
  else if (route === 'settings') body = <>
    {params.notice ? <View style={s.content}><Notice>{params.notice}</Notice></View> : null}
    <Settings profile={user.profile} characters={user.characters} affinity={user.affinity} guest={guest}
    background={user.background} onBackground={id => void saveUser(current => ({ ...current, background: id })).catch(() => setError('배경색을 저장하지 못했어요.'))}
    onRegister={() => go('account', { register: true })}
    onEditProfile={() => editProfile('edit')} onEditCharacter={editCharacter} onRemove={askRemove} onLogout={signOut} onPrivacy={() => go('privacy')} /></>;
  else if (route !== 'chat' || !person) body = <View style={s.recovery}><Notice danger>화면을 불러오지 못했어요. 다시 시도해 주세요.</Notice>
    <Action onPress={() => go('house')}>채팅방으로</Action></View>;
  const darkStatus = ['signals', 'signalDetail', 'senderPick', 'guessResult'].includes(route);

  const background = backgroundOf(user?.background);
  return <BackgroundContext.Provider value={background}><SafeAreaView style={s.root}>
    <StatusBar style={darkStatus ? 'light' : 'dark'} />
    <View style={[s.frame, { backgroundColor: background.page }]}>
      <KeyboardAvoidingView style={s.main} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {person ? <Chat key={person.id} person={person} affinity={user.affinity[person.id] ?? 0} messages={user.threads[person.id] ?? []}
          value={drafts[person.id] ?? ''} onChange={value => setDrafts(current => ({ ...current, [person.id]: value }))}
          onSend={(value, retryId) => void send(person, value, retryId)} onBack={() => go('house')}
          onEdit={() => editCharacter(user.characters.indexOf(person), 'chat')} pending={Boolean(pending[person.id])}
          error={chatErrors[person.id]} connection={connection} usage={bazeUsage[person.id]} onBazeNotice={() => setBazeNotice(true)}
          unreadSignals={unreadSignals} onDiary={() => openDiary('house')}
          onSignals={() => go('signals')} onOpenDiary={openDiaryResult} />
          : <ScrollView ref={scroll} key={route} style={s.flex} contentContainerStyle={s.scrollBody} keyboardShouldPersistTaps="handled">{body}</ScrollView>}
        {showTabs ? <Tabs route={tab} onNavigate={go} disabled={busy} badges={{ signals: unreadSignals }} /> : null}
      </KeyboardAvoidingView>
    </View>
    <Confirm dialog={dialog} onCancel={() => { if (!busy) { setDialog(null); setError(''); } }} onConfirm={confirmRemove} busy={busy} error={dialog ? error : ''} />
    <BazeConsent visible={bazeNotice} onCancel={() => setBazeNotice(false)}
      onAccept={() => { setBazeConsent(true); setBazeNotice(false); }} />
  </SafeAreaView></BackgroundContext.Provider>;
}

export default function App() {
  return <SafeAreaProvider><HaruSignal /></SafeAreaProvider>;
}
