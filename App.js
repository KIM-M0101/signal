import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, BackHandler, KeyboardAvoidingView, Platform, ScrollView, Text, useWindowDimensions, View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { chatStatus, getReply, getSignal } from './src/chat-api.js';
import {
  DEFAULT_CHARACTERS, MAX_PHOTO, STORAGE_KEY, archiveRecords, cleanCharacter, emptyState,
  localDate, newMessage, prepareTestSignal, readState, receiveTestSignal, revealTestSignal, safetyReply, testSignalCandidates,
  testSignalLetter, unreadCount, welcomeMessage,
} from './src/model.js';
import {
  Action, Archive, BazeConsent, Chat, Confirm, Conversations, EmptyChat, Intro, Notice,
  Record, Settings, Setup, SignalLetter, Tabs,
} from './src/screens.js';
import { colors, styles as s } from './src/theme.js';

function SignalHouse() {
  const { width } = useWindowDimensions();
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [route, setRoute] = useState('intro');
  const [setup, setSetup] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [archiveTab, setArchiveTab] = useState('records');
  const [signalDate, setSignalDate] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [chatErrors, setChatErrors] = useState({});
  const [pending, setPending] = useState({});
  const [connection, setConnection] = useState({ available: null, provider: null });
  const [bazeConsent, setBazeConsent] = useState(false);
  const [bazeNotice, setBazeNotice] = useState(false);
  const [bazeUsage, setBazeUsage] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const working = useRef(false);
  const requesting = useRef(new Set());
  const dataRef = useRef(null);
  const writeQueue = useRef(Promise.resolve());
  const scroll = useRef(null);
  const setupOrigin = useRef('house');
  const signalOrigin = useRef('archive');

  function updateData(next) {
    dataRef.current = next;
    setData(next);
  }

  async function load() {
    setLoadError('');
    try {
      const saved = readState(await AsyncStorage.getItem(STORAGE_KEY));
      updateData(saved);
      setRoute(saved.characters.length === 2 ? 'house' : 'intro');
    } catch {
      setLoadError('이 기기의 저장된 데이터를 읽지 못했어요.');
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

  const person = data?.characters.find(character => character.id === roomId);
  const messages = person ? data.threads[roomId] ?? [] : [];
  const visibleUnread = route === 'chat' && person ? unreadCount(messages, data.readThrough[roomId]) : 0;
  const visibleLast = messages.at(-1)?.id;
  const records = useMemo(() => data ? archiveRecords(data) : [], [data]);
  const detail = records.find(record => record.id === detailId);
  const today = localDate();
  const todaySignal = data?.signals.find(signal => signal.date === today && signal.message);
  const selectedSignal = data?.signals.find(signal => signal.date === signalDate);
  const letter = selectedSignal ? testSignalLetter(data, selectedSignal) : null;
  const canTestSignal = useMemo(() => testSignalCandidates(records, today).size > 0, [records, today]);

  useEffect(() => { void load(); }, []);
  useEffect(() => { scroll.current?.scrollTo({ y: 0, animated: false }); }, [route, setup?.index]);
  useEffect(() => {
    if (!visibleUnread || !visibleLast) return;
    void save(current => {
      const thread = current.threads[roomId] ?? [];
      const position = thread.findIndex(message => message.id === visibleLast);
      const previous = thread.findIndex(message => message.id === current.readThrough[roomId]);
      if (position <= previous) return current;
      return { ...current, readThrough: { ...current.readThrough, [roomId]: visibleLast } };
    }).catch(() => {});
  }, [roomId, visibleLast, visibleUnread]);
  useEffect(() => {
    if (route !== 'chat' && route !== 'settings') return undefined;
    let active = true;
    const check = async () => {
      const status = await chatStatus();
      if (active) setConnection(current => ({ ...status, provider: status.provider ?? current.provider }));
    };
    void check();
    const timer = setInterval(check, 7000);
    return () => { active = false; clearInterval(timer); };
  }, [route]);
  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      if (working.current) return true;
      if (route === 'setup') { exitSetup(); return true; }
      if (route === 'record') { go('archive'); return true; }
      if (route === 'signal') { go(signalOrigin.current); return true; }
      if (['chat', 'archive', 'settings'].includes(route)) { go('house'); return true; }
      return false;
    });
    return () => back.remove();
  }, [route, setup?.editing, setup?.index]);

  function go(next) {
    if (working.current) return;
    setError('');
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

  function startSetup(index = 0, editing = false) {
    if (working.current) return;
    setupOrigin.current = route;
    setSetup({ index, editing, draft: (editing ? data.characters : DEFAULT_CHARACTERS).map(item => ({ ...item })) });
    go('setup');
  }

  function chooseSetup(index) {
    setSetup(current => ({ ...current, index }));
    setError('');
  }

  function exitSetup() {
    if (working.current) return;
    if (!setup.editing && setup.index === 1) chooseSetup(0);
    else go(setupOrigin.current);
  }

  function changeCharacter(update) {
    setSetup(current => ({ ...current, draft: current.draft.map((item, index) => index === current.index ? { ...item, ...update } : item) }));
    setError('');
  }

  async function pickPhoto() {
    const selectedIndex = setup.index;
    await perform(async () => {
      let result;
      try { result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], base64: true, quality: 0.55, exif: false }); }
      catch { throw new Error('이미지 선택을 열지 못했어요. 기본 아바타를 고를 수 있어요.'); }
      if (result.canceled) return;
      const base64 = result.assets[0]?.base64;
      const mime = base64?.startsWith('iVBOR') ? 'png' : base64?.startsWith('/9j/') ? 'jpeg' : '';
      if (!mime) throw new Error('JPG 또는 PNG 테스트 이미지를 골라 주세요.');
      const photo = 'data:image/' + mime + ';base64,' + base64;
      if (photo.length > MAX_PHOTO) throw new Error('이미지가 너무 커요. 더 작은 테스트 이미지를 골라 주세요.');
      setSetup(current => ({ ...current, draft: current.draft.map((item, index) => index === selectedIndex ? { ...item, photo } : item) }));
    });
  }

  function saveSetup() {
    void perform(async () => {
      const characters = setup.draft.map((item, i) => cleanCharacter(item, DEFAULT_CHARACTERS[i].id));
      if (!characters[setup.index]) throw new Error('지금 설정하는 캐릭터의 이름을 적어 주세요.');
      if (!setup.editing && setup.index === 0) {
        chooseSetup(1);
        return;
      }
      if (characters.some(item => !item)) throw new Error('두 캐릭터의 이름을 모두 적어 주세요.');
      await save(current => {
        if (setup.editing) return { ...current, characters };
        const now = new Date();
        const threads = Object.fromEntries(characters.map(item => [item.id, [welcomeMessage(item, now)]]));
        const readThrough = Object.fromEntries(characters.map(item => [item.id, '']));
        return { ...current, characters, threads, readThrough };
      });
      setRoute(setup.editing ? setupOrigin.current : 'house');
    });
  }

  function openRoom(id) {
    if (working.current) return;
    setRoomId(id);
    go('chat');
  }

  function deliverSignal() {
    if (working.current || requesting.current.size) return;
    if (connection.provider === 'baze' && !bazeConsent) {
      setBazeNotice(true);
      return;
    }
    void perform(async () => {
      const prepared = prepareTestSignal(dataRef.current);
      if (!prepared) throw new Error('오늘 나눈 대화에서 AI 답장을 받은 뒤 시도해 주세요.');
      const message = await getSignal(prepared.sender, prepared.messages, bazeConsent);
      await save(current => receiveTestSignal(current, prepared.signal, message));
    });
  }

  function openSignal(date) {
    if (working.current) return;
    signalOrigin.current = route;
    setSignalDate(date);
    go('signal');
  }

  function showSignals() {
    setArchiveTab('signals');
    go('archive');
  }

  async function send(character, value, retryId) {
    const text = value.trim();
    const id = character.id;
    if (!text || requesting.current.has(id) || working.current) return;
    const safe = safetyReply(text, character);
    if (!safe && connection.provider === 'baze' && !bazeConsent) {
      setBazeNotice(true);
      return;
    }
    requesting.current.add(id);
    setPending(current => ({ ...current, [id]: true }));
    setChatErrors(current => ({ ...current, [id]: '' }));
    try {
      let thread = dataRef.current.threads[id] ?? [];
      if (retryId) {
        if (thread.at(-1)?.id !== retryId || thread.at(-1)?.role !== 'user') return;
      } else {
        const message = newMessage('user', text);
        const saved = await save(current => ({
          ...current, threads: { ...current.threads, [id]: [...(current.threads[id] ?? []), message] },
        }));
        thread = saved.threads[id];
        setDrafts(current => current[id]?.trim() === text ? { ...current, [id]: '' } : current);
      }
      const result = safe ? { reply: safe, source: 'safety' } : await getReply(character, thread, bazeConsent);
      const response = newMessage('assistant', result.reply, result.source);
      await save(current => ({
        ...current, threads: { ...current.threads, [id]: [...(current.threads[id] ?? []), response] },
      }));
      if (connection.provider === 'baze' || result.usage) {
        setBazeUsage(current => ({ ...current, [id]: result.usage ?? null }));
      }
    } catch (failure) {
      setChatErrors(current => ({ ...current, [id]: failure.message || '답장을 받지 못했어요.' }));
    } finally {
      requesting.current.delete(id);
      setPending(current => ({ ...current, [id]: false }));
    }
  }

  function deleteData() {
    void perform(async () => {
      if (requesting.current.size) throw new Error('답장이 끝난 뒤에 데이터를 삭제할 수 있어요.');
      if (confirm === 'all') {
        await writeQueue.current;
        try { await AsyncStorage.removeItem(STORAGE_KEY); }
        catch { throw new Error('저장 데이터를 지우지 못했어요. 잠시 뒤 다시 시도해 주세요.'); }
        updateData(emptyState());
        setLoadError('');
        setSetup(null);
        setRoomId(null);
        setBazeConsent(false);
        setRoute('intro');
      } else {
        await save(current => ({ ...current, entries: [], threads: {}, readThrough: {}, signals: [] }));
      }
      setDetailId(null);
      setSignalDate(null);
      setArchiveTab('records');
      setDrafts({});
      setChatErrors({});
      setBazeUsage({});
      setConfirm(null);
    });
  }

  const ready = data?.characters.length === 2 && !loadError;
  const wide = width >= 800 && ready;
  const chat = route === 'chat' && person;
  const tab = ['archive', 'record', 'signal'].includes(route) ? 'archive' : route === 'settings' ? 'settings' : 'house';
  const showTabs = ready && ['house', 'archive', 'settings'].includes(route);
  const tabs = <Tabs route={tab} onNavigate={go} disabled={busy} />;
  const home = ready ? <Conversations characters={data.characters} threads={data.threads} readThrough={data.readThrough}
    selectedRoom={chat ? roomId : null} onOpen={openRoom} todaySignal={todaySignal} canTestSignal={canTestSignal}
    onOpenSignal={openSignal} /> : null;
  let body;
  if (loadError) body = <View style={s.recovery}><Notice danger>{loadError}</Notice>
    <Action onPress={() => void load()}>다시 읽기</Action><Action kind="soft" onPress={() => setConfirm('all')}>저장 데이터 삭제</Action></View>;
  else if (!data) body = <View style={s.center}><ActivityIndicator color={colors.accent} /><Text style={s.note}>시그널 하우스를 여는 중이에요.</Text></View>;
  else if (route === 'intro') body = <Intro onStart={() => startSetup()} />;
  else if (route === 'setup') body = <Setup {...setup} onChoose={chooseSetup} onChange={changeCharacter} onPickPhoto={pickPhoto}
    onSave={saveSetup} onBack={exitSetup} busy={busy} error={error} />;
  else if (route === 'house') body = wide ? <EmptyChat /> : home;
  else if (route === 'archive') body = <Archive records={records} signals={data.signals} tab={archiveTab} onTabChange={setArchiveTab}
    onOpen={record => { setDetailId(record.id); go('record'); }} onOpenSignal={openSignal} />;
  else if (route === 'record' && detail) body = <Record record={detail} onBack={() => go('archive')} onRoom={openRoom} />;
  else if (route === 'signal' && letter) body = <SignalLetter signal={selectedSignal} letter={letter}
    characters={data.characters} busy={busy} error={error} onBack={() => go(signalOrigin.current)}
    onReveal={guessId => void perform(() => save(current => revealTestSignal(current, selectedSignal.date, guessId)))}
    onArchive={showSignals} />;
  else body = <Settings provider={connection.provider} onEdit={() => startSetup(0, true)} onRemove={type => { setError(''); setConfirm(type); }} />;

  return <SafeAreaView style={s.root}>
    <StatusBar style="dark" />
    <View style={[s.frame, wide && s.wideFrame]}>
      {wide ? <View style={s.sidebar}><ScrollView style={s.flex}>{home}</ScrollView>{tabs}</View> : null}
      <KeyboardAvoidingView style={s.main} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {chat ? <Chat key={person.id} person={person} messages={messages} value={drafts[person.id] ?? ''}
          onChange={value => setDrafts(current => ({ ...current, [person.id]: value }))}
          onSend={(value, retryId) => void send(person, value, retryId)}
          onBack={() => go('house')} onEdit={() => startSetup(data.characters.indexOf(person), true)}
          pending={Boolean(pending[person.id])} error={chatErrors[person.id]} connection={connection}
          usage={bazeUsage[person.id]} onBazeNotice={() => setBazeNotice(true)} todaySignal={todaySignal}
          canTestSignal={canTestSignal} testingSignal={busy} waitingForReplies={Object.values(pending).some(Boolean)}
          signalError={error} onTestSignal={deliverSignal} onOpenSignal={openSignal} />
          : <ScrollView ref={scroll} key={route} style={s.flex} contentContainerStyle={s.scrollBody} keyboardShouldPersistTaps="handled">{body}</ScrollView>}
        {!wide && showTabs ? tabs : null}
      </KeyboardAvoidingView>
    </View>
    <Confirm type={confirm} onCancel={() => { if (!busy) { setConfirm(null); setError(''); } }} onConfirm={deleteData} busy={busy} error={error} />
    <BazeConsent visible={bazeNotice} onCancel={() => setBazeNotice(false)}
      onAccept={() => { setBazeConsent(true); setBazeNotice(false); }} />
  </SafeAreaView>;
}

export default function App() {
  return <SafeAreaProvider><SignalHouse /></SafeAreaProvider>;
}
