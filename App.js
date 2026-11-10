import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, useWindowDimensions, View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import Svg, { Path, SvgXml } from 'react-native-svg';
import { ART } from './src/art.js';
import { chatStatus, getReply } from './src/chat-api.js';
import {
  AVATARS, DEFAULT_CHARACTERS, MAX_ENTRY, MAX_PERSONALITY, MAX_PHOTO, RELATIONS, STORAGE_KEY, TONES, TONE_PROFILES,
  cleanCharacter, dateLabel, emptyState, localDate, newMessage, readState, safetyReply,
} from './src/model.js';

const C = { paper: '#FAF8FC', white: '#FFFFFF', ink: '#2C2435', muted: '#665C70', line: '#E8E0EE',
  rust: '#65448C', peach: '#EEE6F7', lilac: '#F2EDF7', plum: '#605073', sage: '#EDF0E8' };
const ICONS = {
  house: 'm3 10 9-7 9 7v10H3zM9 20v-6h6v6',
  book: 'M4 4h5a3 3 0 0 1 3 3v13a4 4 0 0 0-3-2H4zM20 4h-5a3 3 0 0 0-3 3m0 13a4 4 0 0 1 3-2h5z',
  moon: 'M20.5 15A8.5 8.5 0 1 1 9 3.5 8.5 8.5 0 0 0 20.5 15ZM17 3v6m-3-3h6',
  gear: 'M4 7h16M4 17h16M9 4v6m6 4v6',
  spark: 'm12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5z',
  heart: 'M20 6a4.5 4.5 0 0 0-8 1 4.5 4.5 0 0 0-8-1c-5 5 8 14 8 14s13-9 8-14z',
  arrow: 'M4 12h16m-6-6 6 6-6 6',
  back: 'M20 12H4m6-6-6 6 6 6',
  pen: 'm15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L5 15z',
  lock: 'M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5z',
  photo: 'M3 4h18v16H3zM3 17l6-6 4 4 3-3 5 5M8 8h.01',
  check: 'm5 12 4 4 10-10',
};
const TABS = [['house', '대화', 'house'], ['archive', '보관함', 'book'], ['settings', '설정', 'gear']];
const PREVIEW_INFO = '대화와 캐릭터 설정은 다시 보기와 편집을 위해 이 기기 또는 브라우저에 저장돼요. 직접 삭제하거나 앱·브라우저 데이터를 지울 때까지 보관돼요.';

function Icon({ name, size = 22, color = C.ink }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden>
    <Path d={ICONS[name]} stroke={color} strokeWidth={1.65} strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </Svg>;
}
function Button({ children, icon, onPress, variant = 'primary', disabled = false, style, label }) {
  const primary = variant === 'primary';
  const danger = variant === 'danger';
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }}
    disabled={disabled} onPress={onPress} style={({ pressed }) => [
      s.button, primary ? s.primary : danger ? s.danger : s.secondary,
      disabled && s.disabled, pressed && s.pressed, style,
    ]}>
    {icon ? <Icon name={icon} size={17} color={primary || danger ? '#FFF' : C.rust} /> : null}
    <Text style={[s.buttonText, primary || danger ? s.light : s.rust]}>{children}</Text>
  </Pressable>;
}
function Art({ name, width, height }) {
  return <SvgXml xml={ART[name]} width={width} height={height} />;
}
function Avatar({ person, size = 52 }) {
  return <View style={[s.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
    {person.photo ? <Image source={{ uri: person.photo }} style={{ width: size, height: size }} accessibilityIgnoresInvertColors />
      : <Art name={person.avatar} width={size} height={size} />}
  </View>;
}
function Brand() {
  return <View style={s.brand}><View style={s.brandMark}><Icon name="house" color={C.rust} size={22} /></View>
    <View><Text style={s.brandName}>시그널 하우스</Text><Text style={s.brandEnglish}>SIGNAL HOUSE</Text></View></View>;
}
function PageHeading({ eyebrow, title, subtitle }) {
  return <View style={s.heading}><Text style={s.eyebrow}>{eyebrow}</Text>
    <Text accessibilityRole="header" style={s.h1}>{title}</Text>{subtitle ? <Text style={s.body}>{subtitle}</Text> : null}</View>;
}
function Notice({ children, danger = false }) {
  return <View style={[s.notice, danger && s.noticeDanger]} accessibilityLiveRegion="polite">
    <Text style={s.noticeText}>{children}</Text>
  </View>;
}
function Chip({ children, selected, onPress, label }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected }} onPress={onPress}
    style={({ pressed }) => [s.chip, selected && s.chipSelected, pressed && s.pressed]}>
    <Text style={[s.chipText, selected && s.rust]}>{children}</Text>
  </Pressable>;
}
function Tabs({ route, onNavigate, disabled, style }) {
  return <View style={[s.tabs, style]} accessibilityRole="tablist">
    {TABS.map(([id, text, icon]) => {
      const active = id === route || (id === 'archive' && route === 'replies');
      return <Pressable key={id} accessibilityRole="tab" accessibilityState={{ selected: active, disabled }} disabled={disabled}
        onPress={() => onNavigate(id)} style={[s.tab, active && s.tabSelected]}>
        <Icon name={icon} size={20} color={active ? C.rust : C.muted} />
        <Text style={[s.tabText, active && s.rust]}>{text}</Text>
      </Pressable>;
    })}
  </View>;
}

function Intro({ wide, onStart }) {
  return <View style={[s.intro, wide && s.introWide]}>
    <View style={[s.introCopy, wide && s.introCopyWide]}>
      <Text style={s.eyebrow}>하루 끝에 만나는 다정한 집</Text>
      <Text accessibilityRole="header" style={[s.introTitle, wide && s.introTitleWide]}>오늘 하루를,{'\n'}<Text style={s.rust}>내 캐릭터에게.</Text></Text>
      <Text style={s.body}>오늘 해낸 일도, 말하고 싶었던 마음도 나만의 캐릭터와 나눠 보세요.</Text>
      <Text style={s.body}>처음에 두 캐릭터를 만들면 각자의 방에서 대화를 시작할 수 있어요.</Text>
      <Button onPress={onStart} icon="arrow" style={s.introButton}>시작하기</Button>
      <Text style={s.micro}>나만의 두 캐릭터와 만나는 곳</Text>
    </View>
    <View style={[s.introArt, wide && s.introArtWide]}>
      <View style={s.introArtBadge}><Icon name="spark" color={C.rust} size={14} /><Text style={s.badgeText}>나만의 응원 집</Text></View>
      <Art name="house" width={wide ? 340 : 260} height={wide ? 194 : 145} />
      <View style={s.introFriends}><Avatar person={DEFAULT_CHARACTERS[0]} size={52} /><Avatar person={DEFAULT_CHARACTERS[1]} size={52} /></View>
    </View>
  </View>;
}
function Setup({ draft, index, onChoose, onChange, onPickPhoto, onSave, onBack, editing, busy, error }) {
  const person = draft[index];
  return <>
    <Button variant="secondary" icon="back" onPress={onBack} disabled={busy} style={s.fit}>{editing ? '돌아가기' : '소개로'}</Button>
    <PageHeading eyebrow={editing ? '나의 시그널 대상' : '하우스 준비'} title={editing ? '캐릭터 설정' : '응원받고 싶은 두 사람'}
      subtitle="별명과 관계, 말투를 정해 두 캐릭터를 각각 만들어 보세요." />
    <View style={s.setupSwitch}>
      {draft.map((item, i) => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`${i + 1}번째 캐릭터 설정`}
        accessibilityState={{ selected: i === index, disabled: busy }} disabled={busy} onPress={() => onChoose(i)} style={[s.setupTab, i === index && s.setupSelected]}>
        <Avatar person={item} size={34} /><View style={s.grow}><Text style={s.micro}>캐릭터 {i + 1}</Text>
          <Text numberOfLines={1} style={s.smallStrong}>{item.name.trim() || '이름 입력'}</Text></View>
      </Pressable>)}
    </View>
    <View style={s.card}>
      <View style={s.row}><Avatar person={person} size={67} /><View style={s.grow}>
        <Text style={s.h3}>{person.name.trim() || `캐릭터 ${index + 1}`}</Text><Text style={s.body}>{person.relation} · {person.tone}</Text>
      </View></View>
      <Text style={s.fieldLabel}>기본 아바타</Text>
      <View style={s.wrap}>{AVATARS.map(avatar => <Pressable key={avatar.id} accessibilityRole="button" accessibilityLabel={avatar.label}
        accessibilityState={{ selected: person.avatar === avatar.id && !person.photo }} onPress={() => onChange({ avatar: avatar.id, photo: '' })}
        style={[s.avatarOption, avatar.id === person.avatar && !person.photo && s.avatarSelected]}>
        <Avatar person={avatarPerson(avatar.id)} size={43} />
      </Pressable>)}</View>
      <Button variant="secondary" icon="photo" onPress={onPickPhoto} disabled={busy} style={s.fit}>테스트 이미지 선택</Button>
      <Text style={s.micro}>합성 이미지나 직접 그린 그림을 사용해 주세요. 선택한 이미지는 이 기기에만 저장돼요.</Text>
      {person.photo ? <Button variant="secondary" onPress={() => onChange({ photo: '' })} style={s.fit}>이미지 지우고 아바타 쓰기</Button> : null}
      <Text style={s.fieldLabel}>캐릭터 이름</Text>
      <TextInput accessibilityLabel="캐릭터 이름" value={person.name} maxLength={16} onChangeText={name => onChange({ name })}
        style={s.input} placeholder="예: 솔" placeholderTextColor={C.muted} />
      <Text style={s.fieldLabel}>나와의 관계</Text>
      <View style={s.wrap}>{RELATIONS.map(relation => <Chip key={relation} selected={person.relation === relation}
        onPress={() => onChange({ relation })}>{relation}</Chip>)}</View>
      <Text style={s.fieldLabel}>캐릭터가 나를 부르는 호칭 <Text style={s.optional}>선택</Text></Text>
      <TextInput accessibilityLabel="캐릭터가 나를 부르는 호칭" value={person.address} maxLength={16}
        onChangeText={address => onChange({ address })} style={s.input} placeholder="예: 하루" placeholderTextColor={C.muted} />
      <Text style={s.fieldLabel}>응원 말투</Text>
      <View style={s.wrap}>{TONES.map(tone => <Chip key={tone} selected={person.tone === tone}
        onPress={() => onChange({ tone })}>{tone}</Chip>)}</View>
      <Text style={s.fieldLabel}>성격과 대화 방식 <Text style={s.optional}>선택</Text></Text>
      <TextInput accessibilityLabel="성격과 대화 방식" value={person.personality ?? ''} maxLength={MAX_PERSONALITY}
        onChangeText={personality => onChange({ personality })} multiline textAlignVertical="top"
        style={[s.input, s.personality]} placeholder="예: 평소엔 장난스럽지만 힘든 이야기엔 진지하게 들어줘."
        placeholderTextColor={C.muted} />
      <View style={s.quote}><Text style={s.micro}>{TONE_PROFILES[person.tone].trait}</Text>
        <Text style={s.body}>“{TONE_PROFILES[person.tone].example}”</Text></View>
      {error ? <Notice danger>{error}</Notice> : null}
      <Button icon={editing || index === 1 ? 'check' : 'arrow'} onPress={onSave} disabled={busy}>
        {editing ? '설정 저장하기' : index === 0 ? '다음 캐릭터' : '하우스 입장하기'}
      </Button>
    </View>
  </>;
}
function avatarPerson(id) { return { avatar: id, photo: '' }; }

function Conversations({ characters, threads, onOpen, onEdit }) {
  return <>
    <View style={s.chatHero}>
      <View style={s.grow}>
        <Text style={s.eyebrow}>MY SIGNAL HOUSE</Text>
        <Text accessibilityRole="header" style={s.heroTitle}>오늘, 누구에게{'\n'}이야기를 들려줄까요?</Text>
        <Text style={s.body}>나만의 두 캐릭터에게 마음에 남은 일을 이야기해 보세요.</Text>
      </View>
      <View style={s.heroFaces} accessibilityElementsHidden>
        <Avatar person={characters[0]} size={54} />
        <View style={s.heroFaceSecond}><Avatar person={characters[1]} size={54} /></View>
      </View>
    </View>
    <View style={s.sectionTop}>
      <View style={s.grow}><Text accessibilityRole="header" style={s.h2}>내 대화방</Text></View>
      <Button variant="secondary" icon="pen" onPress={onEdit}>캐릭터 편집</Button>
    </View>
    {characters.map(person => {
      const last = threads[person.id]?.at(-1);
      return <Pressable key={person.id} accessibilityRole="button" accessibilityLabel={`${person.name} 채팅 열기`}
        onPress={() => onOpen(person.id)} style={({ pressed }) => [s.card, s.roomCard, pressed && s.pressed]}>
        <Avatar person={person} size={57} />
        <View style={s.grow}>
          <View style={s.roomName}><Text style={s.h3} numberOfLines={1}>{person.name}</Text><Text style={s.roomBadge}>{person.relation}</Text></View>
          <Text numberOfLines={1} style={s.body}>{last ? (last.role === 'user' ? '나 · ' : '') + last.text : '아직 나눈 이야기가 없어요. 먼저 말을 걸어볼까요?'}</Text>
        </View>
        <Icon name="arrow" size={18} color={C.rust} />
      </Pressable>;
    })}
  </>;
}

function Chat({ person, messages, value, onChange, onSend, onBack, onEdit, pending, error, available }) {
  const log = useRef(null);
  const unanswered = messages.at(-1)?.role === 'user';
  const scrollToLatest = () => log.current?.scrollToEnd({ animated: false });
  return <View style={s.chatPanel}>
    <View style={s.chatTop}>
      <Pressable accessibilityRole="button" accessibilityLabel="대화 목록으로" onPress={onBack} style={s.backIcon}>
        <Icon name="back" color={C.rust} />
      </Pressable>
      <Avatar person={person} size={43} />
      <View style={s.grow}>
        <Text accessibilityRole="header" style={s.h3} numberOfLines={1}>{person.name}</Text>
        <Text style={s.micro} numberOfLines={1}>{person.relation} · {available === true ? 'AI 연결됨' : available === false ? 'AI 서버 연결 필요' : 'AI 연결 확인 중'}</Text>
      </View>
      <Button variant="secondary" onPress={onEdit}>프로필</Button>
    </View>
    <ScrollView ref={log} style={s.grow} contentContainerStyle={s.chatLog}
      onContentSizeChange={scrollToLatest} keyboardShouldPersistTaps="handled">
      {!messages.length ? <View style={s.chatWelcome}>
        <Avatar person={person} size={62} />
        <Text style={s.h3}>{person.name}에게 먼저 이야기해 보세요.</Text>
        <Text style={s.body}>오늘 해낸 일도, 그냥 마음에 남은 얘기도 좋아요.</Text>
        <View style={s.wrap}>
          <Chip onPress={() => { if (!value.trim()) onChange('오늘 해낸 일을 얘기하고 싶어.'); }}>오늘 해낸 일</Chip>
          <Chip onPress={() => { if (!value.trim()) onChange('오늘은 조금 지쳤어.'); }}>조금 지쳤어</Chip>
        </View>
      </View> : null}
      {messages.map((message, index) => {
        const mine = message.role === 'user';
        const day = localDate(new Date(message.createdAt));
        const showDate = index === 0 || day !== localDate(new Date(messages[index - 1].createdAt));
        return <React.Fragment key={message.id}>
          {showDate ? <Text style={s.chatDate}>{dateLabel(day)}</Text> : null}
          <View style={[s.messageRow, mine && s.mine]}>
            {!mine ? <Avatar person={person} size={31} /> : null}
            <View style={[s.bubble, mine && s.userBubble, message.source === 'safety' && s.safetyBubble]}>
              {message.source === 'safety' ? <Text style={s.eyebrow}>안내</Text> : null}
              <Text style={s.messageText}>{message.text}</Text>
            </View>
          </View>
        </React.Fragment>;
      })}
      {pending ? <View style={s.typing} accessibilityLiveRegion="polite">
        <ActivityIndicator size="small" color={C.rust} /><Text style={s.micro}>{person.name}의 답장을 준비하고 있어요…</Text>
      </View> : null}
      {!pending && (error || unanswered) ? <View style={s.retry} accessibilityLiveRegion="polite">
        <Text style={s.micro}>{error || '마지막 메시지의 답장을 다시 받을 수 있어요.'}</Text>
        {unanswered ? <Button variant="secondary" onPress={() => onSend(messages.at(-1).text, messages.at(-1).id)} style={s.fit}>답장 다시 받기</Button> : null}
      </View> : null}
    </ScrollView>
    <View style={s.composer}>
      <TextInput accessibilityLabel="메시지" multiline value={value} maxLength={MAX_ENTRY} onChangeText={onChange}
        style={[s.input, s.chatInput]} placeholder="메시지를 입력해 주세요" placeholderTextColor={C.muted} />
      <Button icon="arrow" onPress={() => onSend(value)} disabled={pending || !value.trim()} label="메시지 보내기">보내기</Button>
    </View>
  </View>;
}

function Replies({ entry, onBack, fromRecords, onArchive }) {
  return <>
    <Button variant="secondary" icon="back" onPress={onBack} style={s.fit}>{fromRecords ? '기록으로' : '하우스로'}</Button>
    <PageHeading eyebrow={dateLabel(entry.date)} title="오늘의 이야기와 응원" subtitle="두 캐릭터가 이야기마다 각자의 말투로 마음을 전해요." />
    <View style={[s.card, s.entryQuote]}><Text style={s.eyebrow}>내가 남긴 이야기</Text><Text style={s.entryText}>{entry.text}</Text></View>
    {entry.status === 'prepared' ? <Notice>프로토타입에서 준비한 답장으로 체험 중이에요.</Notice> : null}
    {entry.status === 'fallback' ? <Notice>응답을 제때 받지 못해 준비한 답장을 보여드려요.</Notice> : null}
    {entry.status === 'safety' ? <Notice danger>지금은 안전을 먼저 살펴 주세요. 도움이 필요하면 가까운 믿을 만한 사람에게 알려 주세요.</Notice> : null}
    {entry.replies.map((reply, index) => <View key={reply.id} style={[s.card, s.reply, index === 1 && s.replyAlt]}>
      <View style={s.row}><Avatar person={reply} size={45} /><Text style={s.h3}>{reply.name}의 응원</Text></View>
      <Text style={s.replyText}>{reply.message}</Text>
    </View>)}
    <Button variant="secondary" icon="book" onPress={onArchive} style={s.fit}>기록 보관함</Button>
  </>;
}
function Signals({ entries, onOpen }) {
  return <>
    <PageHeading eyebrow="나의 하우스" title="보관함" subtitle="시그널과 지난 이야기를 돌아보는 곳이에요." />
    <View style={[s.card, s.signalSmall]}><View style={s.row}><Icon name="lock" color={C.plum} size={18} /><Text style={s.plumLabel}>준비 중</Text></View>
      <Text style={s.h3}>오늘의 시그널은 아직 준비 중이에요.</Text>
      <Text style={s.body}>도착한 시그널은 이곳에서 확인할 수 있어요.</Text></View>
    <View style={[s.card, s.empty]}><Art name="envelope" width={103} height={85} />
      <Text style={s.h3}>받은 시그널이 없어요</Text></View>
    {entries.length > 0 ? <Text style={s.h2}>지난 이야기</Text> : null}
    {entries.map((entry, index) => <React.Fragment key={entry.id}>
      {(index === 0 || entries[index - 1].date !== entry.date) ? <Text style={s.dateHeader}>{dateLabel(entry.date)}</Text> : null}
      <Pressable accessibilityRole="button" onPress={() => onOpen(entry)} style={[s.card, s.archiveRow]}>
        <View style={s.grow}><Text numberOfLines={2} style={s.entryText}>{entry.text}</Text>
          <Text style={s.micro}>{entry.replies.map(reply => reply.name).join(' · ')}의 응원</Text></View>
        <Icon name="arrow" color={C.rust} size={19} />
      </Pressable>
    </React.Fragment>)}
  </>;
}
function Settings({ onEdit, onRemove, error }) {
  return <>
    <PageHeading eyebrow="나의 하우스" title="설정" subtitle="캐릭터 설정과 이 기기에 저장한 대화를 관리해요." />
    <View style={s.card}><Text style={s.h3}>캐릭터</Text><Text style={s.body}>아바타, 이름, 관계, 호칭과 말투를 바꿀 수 있어요.</Text>
      <Button variant="secondary" icon="pen" onPress={onEdit} style={s.fit}>캐릭터 편집</Button></View>
    <View style={s.card}><Text style={s.h3}>저장과 개인정보</Text><Text style={s.body}>{PREVIEW_INFO}</Text>
      <Text style={s.body}>답장에는 현재 방의 최근 메시지만 사용해요. 개발 PC의 로컬 모델에서 처리하며, 테스트에는 가상의 정보를 사용해 주세요.</Text>
      {error ? <Notice danger>{error}</Notice> : null}
      <Button variant="secondary" onPress={() => onRemove('entries')} style={s.fit}>대화와 기록 지우기</Button>
      <Button variant="danger" onPress={() => onRemove('all')} style={s.fit}>캐릭터와 대화 모두 지우기</Button></View>
  </>;
}
function Confirm({ type, onCancel, onConfirm, busy, error }) {
  return <Modal visible={Boolean(type)} transparent animationType="fade" onRequestClose={onCancel}>
    <View style={s.modalLayer}><View style={s.modal} accessibilityViewIsModal>
      <Text accessibilityRole="header" style={s.h2}>{type === 'entries' ? '대화와 기록을 지울까요?' : '저장된 데이터를 지울까요?'}</Text>
      <Text style={s.body}>{type === 'entries' ? '이 기기에 저장한 두 대화방과 이전 기록이 지워져요.' : '이 기기에 저장한 캐릭터와 이미지, 대화와 기록이 지워져요.'}</Text>
      {error ? <Notice danger>{error}</Notice> : null}
      <Button variant="danger" onPress={onConfirm} disabled={busy}>{busy ? '지우는 중…' : '지우기'}</Button>
      <Button variant="secondary" onPress={onCancel} disabled={busy}>취소</Button>
    </View></View>
  </Modal>;
}

function SignalHouse() {
  const { width } = useWindowDimensions();
  const wide = width >= 850;
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [route, setRoute] = useState('intro');
  const [setup, setSetup] = useState(null);
  const [detail, setDetail] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [chatErrors, setChatErrors] = useState({});
  const [pending, setPending] = useState({});
  const [available, setAvailable] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const working = useRef(false);
  const requesting = useRef(new Set());
  const dataRef = useRef(null);
  const writeQueue = useRef(Promise.resolve());
  const scroll = useRef(null);
  const setupOrigin = useRef('house');

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
  useEffect(() => { void load(); }, []);
  useEffect(() => { scroll.current?.scrollTo({ y: 0, animated: false }); }, [route, setup?.index]);
  useEffect(() => {
    if (route !== 'chat') return undefined;
    let active = true;
    const check = async () => { const ready = await chatStatus(); if (active) setAvailable(ready); };
    void check();
    const timer = setInterval(check, 7000);
    return () => { active = false; clearInterval(timer); };
  }, [route]);

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
  function save(change) {
    const update = writeQueue.current.then(async () => {
      const next = change(dataRef.current);
      try { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)); }
      catch { throw new Error('이 기기에 저장하지 못했어요. 저장 공간을 확인하고 다시 시도해 주세요.'); }
      updateData(next);
      return next;
    });
    writeQueue.current = update.catch(() => {});
    return update;
  }
  function startSetup(index = 0, editing = false) {
    setupOrigin.current = route;
    setSetup({ index, editing, draft: (editing ? data.characters : DEFAULT_CHARACTERS).map(item => ({ ...item })) });
    go('setup');
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
      const photo = `data:image/${mime};base64,${base64}`;
      if (photo.length > MAX_PHOTO) throw new Error('이미지가 너무 커요. 더 작은 테스트 이미지를 골라 주세요.');
      setSetup(current => ({ ...current, draft: current.draft.map((person, index) => index === selectedIndex ? { ...person, photo } : person) }));
    });
  }
  function saveSetup() {
    void perform(async () => {
      const characters = setup.draft.map((person, i) => cleanCharacter(person, DEFAULT_CHARACTERS[i].id));
      if (!characters[setup.index]) throw new Error('지금 설정하는 캐릭터의 이름을 적어 주세요.');
      if (!setup.editing && setup.index === 0) {
        setSetup(current => ({ ...current, index: 1 }));
        return;
      }
      if (characters.some(person => !person)) throw new Error('두 캐릭터의 이름을 모두 적어 주세요.');
      await save(current => ({ ...current, characters }));
      setRoute(setup.editing ? setupOrigin.current : 'house');
    });
  }
  function openRoom(id) {
    setRoomId(id);
    go('chat');
  }
  async function send(person, value, retryId) {
    const text = value.trim();
    const id = person.id;
    if (!text || requesting.current.has(id) || working.current) return;
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
      const safe = safetyReply(text, person);
      const result = safe ? { reply: safe, source: 'safety' } : await getReply(person, thread);
      const response = newMessage('assistant', result.reply, result.source);
      await save(current => ({
        ...current, threads: { ...current.threads, [id]: [...(current.threads[id] ?? []), response] },
      }));
    } catch (failure) {
      setChatErrors(current => ({ ...current, [id]: failure.message || '답장을 받지 못했어요.' }));
    } finally {
      requesting.current.delete(id);
      setPending(current => ({ ...current, [id]: false }));
    }
  }
  function openStory(entry) {
    setDetail(entry);
    go('replies');
  }
  function deleteData() {
    void perform(async () => {
      if (requesting.current.size) throw new Error('답장이 끝난 뒤에 데이터를 지울 수 있어요.');
      if (confirm === 'all') {
        try { await AsyncStorage.removeItem(STORAGE_KEY); }
        catch { throw new Error('저장 데이터를 지우지 못했어요. 잠시 뒤 다시 시도해 주세요.'); }
        updateData(emptyState());
        setLoadError('');
        setDetail(null);
        setSetup(null);
        setRoomId(null);
        setRoute('intro');
      } else {
        await save(current => ({ ...current, entries: [], threads: {} }));
        setDetail(null);
      }
      setDrafts({});
      setChatErrors({});
      setConfirm(null);
    });
  }

  const person = data?.characters.find(character => character.id === roomId);
  if (route === 'chat' && person) {
    return <SafeAreaView style={s.root}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView style={s.grow} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Chat key={person.id} person={person} messages={data.threads[person.id] ?? []} value={drafts[person.id] ?? ''}
          onChange={value => setDrafts(current => ({ ...current, [person.id]: value }))}
          onSend={(value, retryId) => void send(person, value, retryId)} onBack={() => go('house')}
          onEdit={() => startSetup(data.characters.indexOf(person), true)}
          pending={Boolean(pending[person.id])} error={chatErrors[person.id]} available={available} />
      </KeyboardAvoidingView>
    </SafeAreaView>;
  }

  const nav = data?.characters.length === 2 && (TABS.some(([id]) => id === route) || route === 'replies');
  let body;
  if (loadError) body = <View style={s.card}><Notice danger>{loadError}</Notice>
    <Button onPress={() => void load()}>다시 읽기</Button><Button variant="secondary" onPress={() => setConfirm('all')}>저장 데이터 지우기</Button></View>;
  else if (!data) body = <View style={s.empty}><ActivityIndicator color={C.rust} /><Text style={s.body}>하우스를 준비하고 있어요.</Text></View>;
  else if (route === 'intro') body = <Intro wide={wide} onStart={() => startSetup()} />;
  else if (route === 'setup') body = <Setup {...setup} busy={busy} error={error}
    onChoose={index => { setSetup(current => ({ ...current, index })); setError(''); }} onChange={changeCharacter}
    onPickPhoto={() => void pickPhoto()} onSave={saveSetup} onBack={() => go(setupOrigin.current)} />;
  else if (route === 'house') body = <Conversations characters={data.characters} threads={data.threads}
    onOpen={openRoom} onEdit={() => startSetup(0, true)} />;
  else if (route === 'replies' && detail) body = <Replies entry={detail} fromRecords onBack={() => go('archive')} onArchive={() => go('archive')} />;
  else if (route === 'archive') body = <Signals entries={data.entries} onOpen={openStory} />;
  else body = <Settings error={error} onEdit={() => startSetup(0, true)} onRemove={type => { setError(''); setConfirm(type); }} />;

  return <SafeAreaView style={s.root}>
    <StatusBar style="dark" />
    <View style={s.topBar}><View style={s.topInner}>
      <Brand />
      {nav && wide ? <Tabs route={route} onNavigate={go} disabled={busy} style={s.topTabs} />
        : <Text style={s.topDate}>{dateLabel(localDate())}</Text>}
    </View></View>
    <KeyboardAvoidingView style={s.grow} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={s.scroll}>
        <View style={[s.container, route !== 'intro' && s.narrow]}>{body}
          <Text style={s.footer}>오늘의 이야기를 나누는 곳 · 시그널 하우스</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
    {nav && !wide ? <Tabs route={route} onNavigate={go} disabled={busy} style={s.bottomTabs} /> : null}
    <Confirm type={confirm} onCancel={() => { if (!busy) { setConfirm(null); setError(''); } }} onConfirm={deleteData} busy={busy} error={error} />
  </SafeAreaView>;
}

export default function App() {
  return <SafeAreaProvider><SignalHouse /></SafeAreaProvider>;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },
  grow: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  topBar: { backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.line },
  topInner: { alignSelf: 'center', width: '100%', maxWidth: 1100, minHeight: 65, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  brand: { flexDirection: 'row', gap: 9, alignItems: 'center' },
  brandMark: { width: 39, height: 39, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: C.peach },
  brandName: { color: C.ink, fontSize: 15, fontWeight: '800', letterSpacing: -.4 },
  brandEnglish: { color: C.muted, fontSize: 8, letterSpacing: 2, marginTop: 2, fontWeight: '700' },
  topDate: { color: C.muted, fontSize: 11, textAlign: 'right', flexShrink: 1 },
  tabs: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  topTabs: { gap: 7 },
  bottomTabs: { paddingHorizontal: 12, paddingVertical: 5, borderTopWidth: 1, borderColor: C.line, backgroundColor: C.white, justifyContent: 'space-around' },
  tab: { paddingVertical: 7, paddingHorizontal: 12, minHeight: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 3 },
  tabSelected: { backgroundColor: C.peach },
  tabText: { fontSize: 10, fontWeight: '700', color: C.muted },
  scroll: { alignItems: 'center', paddingHorizontal: 16, paddingTop: 21, paddingBottom: 14 },
  container: { width: '100%', maxWidth: 1060, gap: 15 },
  narrow: { maxWidth: 700 },
  footer: { color: C.muted, fontSize: 10, textAlign: 'center', marginTop: 13, marginBottom: 5, lineHeight: 17 },
  intro: { padding: 21, gap: 18, borderRadius: 28, backgroundColor: C.peach, borderWidth: 1, borderColor: '#E2D4EE' },
  introWide: { minHeight: 490, flexDirection: 'row', alignItems: 'center', padding: 46, gap: 30 },
  introCopy: { gap: 13 },
  introCopyWide: { flex: 1, minWidth: 0 },
  introTitle: { fontSize: 40, lineHeight: 49, letterSpacing: -2.2, fontWeight: '800', color: C.ink },
  introTitleWide: { fontSize: 57, lineHeight: 67, letterSpacing: -3 },
  introButton: { alignSelf: 'flex-start', marginTop: 5 },
  introArt: { borderRadius: 20, backgroundColor: '#F9F4FD', alignItems: 'center', justifyContent: 'center', minHeight: 205, padding: 12 },
  introArtWide: { width: 410, minHeight: 335, borderRadius: 25 },
  introArtBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.white, paddingVertical: 5, paddingHorizontal: 9, borderRadius: 20 },
  badgeText: { color: C.rust, fontSize: 10, fontWeight: '700' },
  introFriends: { flexDirection: 'row', gap: 7, marginTop: -7 },
  heading: { gap: 7, marginBottom: 2 },
  eyebrow: { color: C.rust, fontWeight: '800', fontSize: 11, letterSpacing: .8 },
  h1: { color: C.ink, fontSize: 31, letterSpacing: -1.5, fontWeight: '800', lineHeight: 41 },
  h2: { color: C.ink, fontSize: 22, letterSpacing: -.7, fontWeight: '800' },
  h3: { color: C.ink, fontSize: 16, letterSpacing: -.3, fontWeight: '800', flexShrink: 1 },
  body: { fontSize: 13, color: C.muted, lineHeight: 21 },
  micro: { color: C.muted, fontSize: 11, lineHeight: 17 },
  smallStrong: { color: C.ink, fontSize: 13, fontWeight: '700' },
  rust: { color: C.rust },
  light: { color: '#FFF' },
  fit: { alignSelf: 'flex-start' },
  end: { textAlign: 'right' },
  button: { minHeight: 44, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primary: { backgroundColor: C.rust, borderColor: C.rust },
  danger: { backgroundColor: '#873D35', borderColor: '#873D35' },
  secondary: { backgroundColor: C.white, borderColor: C.line },
  buttonText: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  disabled: { opacity: .47 },
  pressed: { opacity: .78 },
  card: { backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 19, padding: 17, gap: 10 },
  avatar: { overflow: 'hidden', flexShrink: 0, backgroundColor: '#F1E8DF' },
  chatHero: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 21, borderRadius: 23, backgroundColor: C.peach },
  heroTitle: { fontSize: 27, lineHeight: 35, fontWeight: '800', color: C.ink, letterSpacing: -1.3, marginVertical: 6 },
  heroFaces: { alignItems: 'center', paddingLeft: 5 },
  heroFaceSecond: { marginTop: -10, marginLeft: 24 },
  sectionTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 7 },
  roomCard: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 84, borderRadius: 17 },
  roomName: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 3 },
  roomBadge: { color: C.rust, backgroundColor: C.lilac, fontSize: 10, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 5 },
  personality: { minHeight: 81, lineHeight: 22 },
  chatPanel: { flex: 1, width: '100%', maxWidth: 760, alignSelf: 'center', backgroundColor: C.white, borderColor: C.line, borderLeftWidth: 1, borderRightWidth: 1 },
  chatTop: { flexDirection: 'row', alignItems: 'center', gap: 9, borderBottomWidth: 1, borderColor: C.line, paddingVertical: 11, paddingHorizontal: 12 },
  backIcon: { width: 43, minHeight: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  chatLog: { flexGrow: 1, gap: 13, paddingHorizontal: 15, paddingVertical: 18, backgroundColor: C.paper },
  chatWelcome: { alignItems: 'center', gap: 9, paddingVertical: 26, paddingHorizontal: 8 },
  chatDate: { color: C.muted, textAlign: 'center', fontSize: 11, marginVertical: 3 },
  messageRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  mine: { justifyContent: 'flex-end' },
  bubble: { backgroundColor: C.white, borderWidth: 1, borderColor: C.line, paddingVertical: 9, paddingHorizontal: 12, borderRadius: 16, borderTopLeftRadius: 5, maxWidth: '84%', gap: 4 },
  userBubble: { backgroundColor: C.peach, borderColor: '#E5D6F1', borderTopLeftRadius: 16, borderTopRightRadius: 5 },
  safetyBubble: { backgroundColor: '#FBF0E6', borderColor: '#EEDCCB' },
  messageText: { color: C.ink, fontSize: 15, lineHeight: 23 },
  typing: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 8 },
  retry: { backgroundColor: C.lilac, borderRadius: 11, padding: 11, gap: 7 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 11, borderTopWidth: 1, borderColor: C.line, backgroundColor: C.white },
  chatInput: { flex: 1, minWidth: 0, minHeight: 44, maxHeight: 120, lineHeight: 22, paddingVertical: 9 },
  signalSmall: { backgroundColor: C.lilac, borderColor: '#E2D9EC' },
  plumLabel: { color: C.plum, fontSize: 11, fontWeight: '800' },
  setupSwitch: { flexDirection: 'row', gap: 8 },
  setupTab: { flex: 1, minWidth: 0, minHeight: 55, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.white, borderRadius: 12, padding: 8, borderWidth: 1, borderColor: C.line },
  setupSelected: { backgroundColor: C.peach, borderColor: '#B298CC' },
  avatarOption: { borderRadius: 50, borderWidth: 2, borderColor: 'transparent', padding: 3 },
  avatarSelected: { borderColor: C.rust },
  fieldLabel: { fontSize: 13, color: C.ink, fontWeight: '700', marginTop: 4 },
  optional: { fontSize: 11, color: C.muted, fontWeight: '500' },
  input: { minHeight: 47, paddingHorizontal: 12, paddingVertical: 10, borderColor: C.line, borderWidth: 1, borderRadius: 11, fontSize: 16, color: C.ink, backgroundColor: C.paper },
  chip: { minHeight: 38, paddingHorizontal: 10, justifyContent: 'center', borderRadius: 20, borderColor: C.line, borderWidth: 1, backgroundColor: C.white },
  chipSelected: { backgroundColor: C.peach, borderColor: '#CB927E' },
  chipText: { fontSize: 12, fontWeight: '700', color: C.muted },
  quote: { padding: 11, gap: 5, borderRadius: 10, backgroundColor: C.sage },
  notice: { borderRadius: 11, paddingVertical: 9, paddingHorizontal: 11, backgroundColor: C.sage },
  noticeDanger: { backgroundColor: '#F9E4DD' },
  noticeText: { color: C.ink, fontSize: 12, lineHeight: 19 },
  entryQuote: { backgroundColor: '#FFF4EC', borderColor: '#EDDCD0' },
  entryText: { color: C.ink, fontSize: 15, lineHeight: 24 },
  reply: { borderLeftWidth: 4, borderLeftColor: '#D69C82' },
  replyAlt: { borderLeftColor: '#899E81' },
  replyText: { color: C.ink, fontSize: 15, lineHeight: 24 },
  empty: { alignItems: 'center', paddingVertical: 25, gap: 12 },
  emptyIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: C.peach, alignItems: 'center', justifyContent: 'center' },
  dateHeader: { color: C.muted, fontSize: 12, fontWeight: '700' },
  archiveRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
  modalLayer: { flex: 1, padding: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#302B2999' },
  modal: { width: '100%', maxWidth: 420, padding: 22, borderRadius: 21, backgroundColor: C.white, gap: 12 },
});
