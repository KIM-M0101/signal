import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Svg, { Defs, Ellipse, LinearGradient, Path, Stop, SvgXml } from 'react-native-svg';
import { ART } from './art.js';
import { AVATARS, MAX_ENTRY, MAX_PERSONALITY, RELATIONS, TONES, dateLabel, localDate, unreadCount } from './model.js';
import { colors as C, styles as s } from './theme.js';

const icons = {
  chat: 'M21 11.5a8.5 8.5 0 0 1-8.5 8.5 9 9 0 0 1-3.5-.7L3 21l1.7-5.7a9 9 0 0 1-.7-3.8 8.5 8.5 0 0 1 17 0Z',
  archive: 'M4 8v12h16V8M3 4h18v4H3zM9 12h6',
  gear: 'M4 7h16M4 17h16M9 4v6m6 4v6',
  moon: 'M20 15a8 8 0 1 1-11-11 8 8 0 0 0 11 11ZM17 2v6m-3-3h6',
  lock: 'M8 10V7a4 4 0 0 1 8 0v3M6 10h12v11H6z',
  arrow: 'M4 12h16m-6-6 6 6-6 6',
  up: 'M12 20V4m-6 6 6-6 6 6',
  back: 'm15 18-6-6 6-6',
  next: 'm9 18 6-6-6-6',
  down: 'm6 9 6 6 6-6',
  mail: 'M3 5h18v14H3zM3 6l9 7 9-7',
  shield: 'M12 22s8-3.6 8-11V5l-8-3-8 3v6c0 7.4 8 11 8 11Zm-3-10 2 2 4-4',
};
const time = new Intl.DateTimeFormat('ko-KR', { hour: 'numeric', minute: '2-digit' });
const shortDate = new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric' });
const destinations = [['house', '채팅', 'chat'], ['archive', '보관함', 'archive'], ['settings', '설정', 'gear']];

function Icon({ name, color = C.accent, size = 20 }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
    <Path d={icons[name]} fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>;
}

export function Action({ children, onPress, icon, kind = 'primary', disabled = false }) {
  const light = kind !== 'soft';
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [s.action, s[kind], disabled && s.disabled, pressed && s.pressed]}>
    <Text style={[s.actionText, light && s.whiteText]}>{children}</Text>
    {icon ? <Icon name={icon} size={16} color={light ? C.paper : C.accent} /> : null}
  </Pressable>;
}

function Avatar({ person, size = 48 }) {
  const dimensions = { width: size, height: size, borderRadius: size / 2 };
  return <View style={[s.avatar, dimensions]} accessibilityElementsHidden>
    {person.photo ? <Image source={{ uri: person.photo }} style={dimensions} /> : <SvgXml xml={ART[person.avatar]} width={size} height={size} />}
  </View>;
}

function Brand() {
  return <View style={s.brand}><Text style={s.brandMark}>✦</Text><Text style={s.brandWord}>SIGNAL HOUSE</Text></View>;
}

function Header({ title, onBack, tag }) {
  return <View style={s.header}>
    {onBack ? <Pressable accessibilityRole="button" accessibilityLabel="뒤로" onPress={onBack} style={s.iconButton}>
      <Icon name="back" color={C.ink} size={24} />
    </Pressable> : null}
    <Text accessibilityRole="header" style={s.headerTitle} numberOfLines={1}>{title}</Text>
    {tag ? <Text style={s.tag}>{tag}</Text> : null}
  </View>;
}

export function Notice({ children, danger = false }) {
  return <View accessibilityLiveRegion="polite" style={[s.notice, danger && s.noticeDanger]}><Text style={[s.note, danger && s.dangerText]}>{children}</Text></View>;
}

function Segment({ options, value, onChange, disabled = false }) {
  return <View style={s.segment}>
    {options.map(([id, label]) => <Pressable key={id} accessibilityRole="button" accessibilityState={{ selected: id === value, disabled }}
      disabled={disabled} onPress={() => onChange(id)} style={[s.segmentButton, id === value && s.segmentActive]}>
      <Text numberOfLines={1} style={[s.note, id === value && s.segmentLabel]}>{label}</Text>
    </Pressable>)}
  </View>;
}

export function Tabs({ route, onNavigate, disabled }) {
  return <View style={s.tabs} accessibilityRole="tablist">
    {destinations.map(([id, label, icon]) => {
      const active = id === route;
      return <Pressable key={id} accessibilityRole="tab" accessibilityState={{ selected: active, disabled }}
        onPress={() => onNavigate(id)} disabled={disabled} style={s.tab}>
        <Icon name={icon} color={active ? C.accent : C.muted} />
        <Text style={[s.note, active && s.segmentLabel]}>{label}</Text>
      </Pressable>;
    })}
  </View>;
}

function Orbit({ night = false }) {
  return <Svg width="100%" height={night ? 112 : 194} viewBox="0 0 296 192" accessible={false}>
    <Defs><LinearGradient id="signal-orbit" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#AE8CDE" /><Stop offset="1" stopColor="#7750B4" /></LinearGradient></Defs>
    <Ellipse cx="147" cy="96" rx="113" ry="52" rotation="-24" originX="147" originY="96" stroke={night ? '#A77CD5' : '#BEA2E5'} opacity={0.6} />
    <Ellipse cx="147" cy="96" rx="123" ry="62" rotation="22" originX="147" originY="96" stroke={night ? '#8660B0' : '#DFCCF3'} />
    <Path d="M216 32l3 8 8 3-8 3-3 8-3-8-8-3 8-3zm-154 87 2 6 6 2-6 2-2 6-2-6-6-2 6-2z" fill={night ? '#EACFFD' : '#8F5AC4'} />
    <Path d="M116 58h58a21 21 0 0 1 21 21v31a21 21 0 0 1-21 21h-40l-18 11v-11a21 21 0 0 1-21-21V79a21 21 0 0 1 21-21Z" fill="url(#signal-orbit)" />
    {night ? <Path d="M126 82h42v27h-42zm0 1 21 16 21-16" fill="none" stroke="#FFFFFF" strokeWidth={2.5} strokeLinejoin="round" />
      : <Path d="M147 111s-20-11-20-23a10 10 0 0 1 20-3 10 10 0 0 1 20 3c0 12-20 23-20 23Z" fill="none" stroke="#FFFFFF" strokeWidth={2.5} />}
  </Svg>;
}

export function Intro({ onStart }) {
  return <View style={s.intro}>
    <View style={s.introArt}><Orbit /></View>
    <Brand />
    <Text accessibilityRole="header" style={s.introTitle}>오늘의 나를{'\n'}알아봐 주는 대화</Text>
    <Text style={s.body}>작게 해낸 일도, 힘들었던 마음도.{'\n'}내가 만든 캐릭터에게 들려줘요.</Text>
    <Action icon="arrow" onPress={onStart}>시작하기</Action>
  </View>;
}

function Field({ label, value, onChangeText, limit, placeholder, multiline }) {
  return <View style={s.field}>
    <Text style={s.label}>{label}</Text>
    <TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} maxLength={limit} placeholder={placeholder}
      placeholderTextColor={C.muted} multiline={multiline} style={[s.input, multiline && s.textarea]} />
  </View>;
}

function ChoiceField({ label, value, onPress, disabled }) {
  return <View style={s.field}>
    <Text style={s.label}>{label}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={label + ', ' + value} disabled={disabled} onPress={onPress} style={[s.input, s.choice]}>
      <Text style={s.body}>{value}</Text><Icon name="down" size={15} />
    </Pressable>
  </View>;
}

export function Setup({ draft, index, onChoose, onChange, onPickPhoto, onSave, onBack, editing, busy, error }) {
  const [choice, setChoice] = useState(null);
  const [avatarsOpen, setAvatarsOpen] = useState(false);
  const person = draft[index];
  const relations = choice === 'relation';
  return <View style={s.page}>
    <Header title="캐릭터 설정" onBack={onBack} />
    <View style={s.content}>
      <Segment value={index} disabled={busy} options={draft.map((item, i) => [i, (i === 0 ? '첫 번째 ' : '두 번째 ') + item.name])}
        onChange={i => { setAvatarsOpen(false); onChoose(i); }} />
      <View style={s.photoRow}>
        <Avatar person={person} size={56} />
        <View style={s.flex}>
          <Text style={s.label}>프로필 이미지</Text>
          <View style={s.wrap}>
            <Action kind="soft" onPress={onPickPhoto} disabled={busy}>사진 선택</Action>
            <Action kind="soft" onPress={() => setAvatarsOpen(!avatarsOpen)} disabled={busy}>기본 아바타 변경</Action>
          </View>
        </View>
      </View>
      {avatarsOpen ? <View style={s.wrap}>
        {AVATARS.map(avatar => <Pressable key={avatar.id} accessibilityRole="button" accessibilityLabel={avatar.label}
          accessibilityState={{ selected: person.avatar === avatar.id && !person.photo }}
          style={[s.avatarOption, person.avatar === avatar.id && !person.photo && s.avatarSelected]}
          onPress={() => { onChange({ avatar: avatar.id, photo: '' }); setAvatarsOpen(false); }}>
          <Avatar person={{ avatar: avatar.id }} size={40} />
        </Pressable>)}
      </View> : null}
      <Text style={s.note}>테스트에는 합성 이미지나 직접 그린 그림을 사용해 주세요.</Text>
      <View style={s.formRow}>
        <Field label="이름" value={person.name} onChangeText={name => onChange({ name })} limit={16} />
        <Field label="나를 부를 호칭" value={person.address} onChangeText={address => onChange({ address })} limit={16} placeholder="선택" />
      </View>
      <View style={s.formRow}>
        <ChoiceField label="관계" value={person.relation} onPress={() => setChoice('relation')} disabled={busy} />
        <ChoiceField label="대화 말투" value={person.tone} onPress={() => setChoice('tone')} disabled={busy} />
      </View>
      <Field label="성격과 대화 방식 · 선택" value={person.personality ?? ''} onChangeText={personality => onChange({ personality })}
        limit={MAX_PERSONALITY} placeholder="예: 힘든 얘기는 먼저 차분히 들어줘." multiline />
      {error ? <Notice danger>{error}</Notice> : null}
      <Action onPress={onSave} disabled={busy} icon={editing ? undefined : 'arrow'}>
        {editing ? '설정 저장' : index === 0 ? '다음 캐릭터' : '채팅 시작하기'}
      </Action>
    </View>
    <Modal visible={Boolean(choice)} transparent animationType="fade" onRequestClose={() => setChoice(null)}>
      <View style={s.modalLayer}><View style={s.dialog} accessibilityViewIsModal>
        <Text accessibilityRole="header" style={s.title}>{relations ? '관계 선택' : '대화 말투 선택'}</Text>
        {(relations ? RELATIONS : TONES).map(option => <Pressable key={option} accessibilityRole="button"
          accessibilityState={{ selected: person[choice] === option }} style={s.choiceOption}
          onPress={() => { onChange({ [choice]: option }); setChoice(null); }}>
          <Text style={person[choice] === option ? s.segmentLabel : s.body}>{option}</Text>
        </Pressable>)}
        <Action kind="soft" onPress={() => setChoice(null)}>닫기</Action>
      </View></View>
    </Modal>
  </View>;
}

function Emblem({ icon }) {
  return <View style={s.emblem}><Icon name={icon} size={18} /></View>;
}

export function Conversations({ characters, threads, readThrough, selectedRoom, onOpen }) {
  const rooms = characters.map(person => {
    const messages = threads[person.id] ?? [];
    return { person, last: messages.at(-1), unread: unreadCount(messages, readThrough[person.id]) };
  }).sort((a, b) => (b.last ? Date.parse(b.last.createdAt) : 0) - (a.last ? Date.parse(a.last.createdAt) : 0));
  return <View style={s.page}>
    <View style={s.homeTitle}><Brand /><Text accessibilityRole="header" style={s.homeHeading}>채팅</Text></View>
    <View style={s.rooms}>
      {rooms.map(({ person, last, unread }) => <Pressable key={person.id} accessibilityRole="button"
        accessibilityLabel={person.name + ' 채팅 열기' + (unread ? ', 읽지 않은 메시지 ' + unread + '개' : '')}
        onPress={() => onOpen(person.id)} style={({ pressed }) => [s.room, (unread > 0 || person.id === selectedRoom) && s.roomSelected, pressed && s.pressed]}>
        <Avatar person={person} size={49} />
        <View style={s.roomText}>
          <Text style={s.peerName} numberOfLines={1}>{person.name}</Text>
          <Text numberOfLines={1} style={s.note}>{last ? (last.role === 'user' ? '나 · ' : '') + last.text : '아직 나눈 대화가 없어요.'}</Text>
        </View>
        <View style={s.roomEnd}>
          {last ? <Text style={s.timestamp}>{localDate(new Date(last.createdAt)) === localDate() ? time.format(new Date(last.createdAt)) : shortDate.format(new Date(last.createdAt))}</Text> : null}
          {unread > 0 ? <Text style={s.badge}>{unread > 99 ? '99+' : unread}</Text> : null}
        </View>
      </Pressable>)}
    </View>
    <View style={s.signalCard}>
      <Emblem icon="moon" />
      <View style={s.flex}><Text style={s.label}>오늘의 시그널</Text>
        <Text style={s.note}>지금은 대화와 지난 기록을 볼 수 있어요.</Text>
        <View style={s.locked}><Icon name="lock" size={13} /><Text style={s.note}>준비 중</Text></View>
      </View>
    </View>
  </View>;
}

export function EmptyChat() {
  return <View style={s.center}><Emblem icon="chat" /><Text style={s.title}>오늘 이야기를 들려줄 사람</Text>
    <Text style={s.note}>채팅 목록에서 캐릭터를 선택해요.</Text></View>;
}

export function Chat({ person, messages, value, onChange, onSend, onBack, onEdit, pending, error, available }) {
  const list = useRef(null);
  const nearEnd = useRef(true);
  const [focused, setFocused] = useState(false);
  const last = messages.at(-1);
  const unanswered = last?.role === 'user';
  const scrollToEnd = () => { if (nearEnd.current) list.current?.scrollToEnd({ animated: false }); };
  useEffect(scrollToEnd, [pending]);
  function send() {
    nearEnd.current = true;
    onSend(value);
  }
  return <View style={s.chat}>
    <View style={s.chatHeader}>
      <Pressable accessibilityRole="button" accessibilityLabel="채팅 목록으로" onPress={onBack} style={s.iconButton}>
        <Icon name="back" color={C.ink} size={24} />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={person.name + ' 프로필 편집'} onPress={onEdit} style={s.chatProfile}>
        <Avatar person={person} size={36} />
        <View style={s.flex}><Text accessibilityRole="header" style={s.peerName} numberOfLines={1}>{person.name}</Text>
          <Text style={s.note}>AI 캐릭터</Text></View>
      </Pressable>
      <Text style={s.chatSpark}>✦</Text>
    </View>
    {available === false ? <View style={s.connection}><Text style={s.note}>로컬 AI 서버에 연결할 수 없어요.</Text></View> : null}
    <ScrollView ref={list} style={s.flex} contentContainerStyle={s.messages} onContentSizeChange={scrollToEnd}
      onLayout={scrollToEnd} onScroll={({ nativeEvent: { contentSize, layoutMeasurement, contentOffset } }) => {
        nearEnd.current = contentSize.height - layoutMeasurement.height - contentOffset.y < 100;
      }} scrollEventThrottle={32} keyboardShouldPersistTaps="handled">
      {messages.length === 0 ? <Text style={s.emptyMessage}>오늘 해낸 일이나 마음에 남은 이야기를 들려줘요.</Text> : null}
      {messages.map((message, index) => {
        const date = new Date(message.createdAt);
        const day = localDate(date);
        const previous = messages[index - 1];
        const newDay = !previous || day !== localDate(new Date(previous.createdAt));
        const mine = message.role === 'user';
        const safety = message.source === 'safety';
        return <React.Fragment key={message.id}>
          {newDay ? <Text style={s.dateChip}>{dateLabel(day)}</Text> : null}
          <View style={[s.messageRow, mine && s.mine]}>
            {!mine ? <Avatar person={person} size={29} /> : null}
            {mine ? <Text style={s.timestamp}>{time.format(date)}</Text> : null}
            <View style={s.messageColumn}>
              {!mine ? <Text style={s.note}>{person.name}</Text> : null}
              <View style={[s.bubble, mine && s.mineBubble, safety && s.safetyBubble]}>
                {safety ? <Text style={s.label}>안전 안내</Text> : null}
                <Text style={s.messageText}>{message.text}</Text>
              </View>
            </View>
            {!mine ? <Text style={s.timestamp}>{time.format(date)}</Text> : null}
          </View>
        </React.Fragment>;
      })}
      {pending ? <View style={s.wait} accessibilityLiveRegion="polite">
        <ActivityIndicator color={C.accent} size="small" /><Text style={s.note}>답장 작성 중</Text>
      </View> : null}
      {!pending && (error || unanswered) ? <View style={s.retry} accessibilityLiveRegion="polite">
        <Text style={[s.note, s.flex]}>{error || '아직 답장이 도착하지 않았어요.'}</Text>
        {unanswered ? <Pressable accessibilityRole="button" onPress={() => onSend(last.text, last.id)} style={s.retryButton}>
          <Text style={s.dangerText}>다시 시도</Text></Pressable> : null}
      </View> : null}
    </ScrollView>
    <View style={[s.composer, focused && s.composerFocused]}>
      <TextInput accessibilityLabel="메시지" multiline numberOfLines={1} value={value} maxLength={MAX_ENTRY} onChangeText={onChange}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={s.chatInput} placeholder="오늘 있었던 일을 들려줘요" placeholderTextColor={C.muted} />
      <Pressable accessibilityRole="button" accessibilityLabel="메시지 보내기"
        accessibilityState={{ disabled: pending || !value.trim() }} disabled={pending || !value.trim()}
        style={[s.send, (pending || !value.trim()) && s.disabled]} onPress={send}>
        <Icon name="up" color={C.paper} size={20} />
      </Pressable>
    </View>
  </View>;
}

export function Archive({ records, onOpen }) {
  const [tab, setTab] = useState('records');
  return <View style={s.page}>
    <Header title="보관함" />
    <View style={s.content}>
      <Segment options={[[ 'records', '지난 기록' ], [ 'signals', '받은 시그널' ]]} value={tab} onChange={setTab} />
      {tab === 'signals' ? <View style={s.empty}><Emblem icon="mail" /><Text style={s.title}>받은 시그널이 없어요</Text>
        <Text style={s.note}>오늘의 시그널은 아직 준비 중이에요.</Text></View> : null}
      {tab === 'records' && records.length === 0 ? <View style={s.empty}><Emblem icon="archive" /><Text style={s.title}>저장된 기록이 없어요</Text>
        <Text style={s.note}>채팅에서 나눈 이야기를 여기에서 볼 수 있어요.</Text></View> : null}
      {tab === 'records' ? records.map((record, index) => <React.Fragment key={record.id}>
        {record.date !== records[index - 1]?.date ? <Text style={s.sectionDate}>{dateLabel(record.date)}</Text> : null}
        <Pressable accessibilityRole="button" onPress={() => onOpen(record)} style={({ pressed }) => [s.record, pressed && s.pressed]}>
          <View style={s.recordDate}><Text style={s.segmentLabel}>{Number(record.date.slice(-2))}</Text></View>
          <View style={s.roomText}><Text style={s.label} numberOfLines={2}>{record.text}</Text>
            <Text style={s.note}>{record.name ? record.name + ' 채팅방' : '이전 기록'}</Text></View>
          <Icon name="next" size={16} />
        </Pressable>
      </React.Fragment>) : null}
    </View>
  </View>;
}

export function Record({ record, onBack, onRoom }) {
  return <View style={s.page}>
    <Header title="지난 이야기" onBack={onBack} />
    <View style={s.content}>
      <Text style={s.sectionDate}>{dateLabel(record.date)}</Text>
      <View style={s.recordDetail}><Text style={s.label}>내가 남긴 이야기</Text><Text style={s.messageText}>{record.text}</Text></View>
      {record.replies.map(reply => <View key={reply.id} style={s.recordDetail}>
        <View style={s.row}><Avatar person={reply} size={35} /><Text style={s.label}>{reply.name}{reply.source === 'safety' ? ' · 안전 안내' : ''}</Text></View>
        <Text style={s.messageText}>{reply.message}</Text>
      </View>)}
      {record.replies.length === 0 ? <Text style={s.note}>아직 저장된 답장이 없어요.</Text> : null}
      {record.roomId ? <Action kind="soft" icon="arrow" onPress={() => onRoom(record.roomId)}>채팅방 열기</Action> : null}
    </View>
  </View>;
}

function SettingsRow({ children, onPress, danger = false }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [s.settingsRow, danger && s.settingsDanger, pressed && s.pressed]}>
    <Text style={danger ? s.dangerText : s.label}>{children}</Text><Icon name="next" color={danger ? C.danger : C.accent} size={16} />
  </Pressable>;
}

export function Settings({ onEdit, onRemove, onSignalPreview }) {
  return <View style={s.page}>
    <Header title="개인정보와 기록" />
    <View style={s.content}>
      <View style={s.signalCardInline}>
        <Emblem icon="shield" />
        <View style={s.flex}><Text style={s.label}>내 대화와 캐릭터 설정</Text>
          <Text style={s.note}>프로필과 대화를 다시 열 수 있게 이 기기나 브라우저에 저장해요. 직접 삭제하거나 앱 데이터를 지울 때까지 보관돼요.</Text>
        </View>
      </View>
      <Text style={s.note}>답장에는 선택한 방의 최근 대화와 캐릭터의 텍스트 설정만 사용해요. 이미지는 이 기기에 저장하고, 답장은 개발 PC의 로컬 모델에서 생성해요.</Text>
      <SettingsRow onPress={onEdit}>캐릭터 편집</SettingsRow>
      <SettingsRow danger onPress={() => onRemove('entries')}>대화 기록 삭제</SettingsRow>
      <SettingsRow danger onPress={() => onRemove('all')}>캐릭터 설정과 대화 삭제</SettingsRow>
      <SettingsRow onPress={onSignalPreview}>시그널 후속안 미리보기</SettingsRow>
    </View>
  </View>;
}

export function Confirm({ type, onCancel, onConfirm, busy, error }) {
  return <Modal visible={Boolean(type)} transparent animationType="fade" onRequestClose={onCancel}>
    <View style={s.modalLayer}><View style={s.dialog} accessibilityViewIsModal>
      <Text accessibilityRole="header" style={s.title}>{type === 'entries' ? '대화 기록을 삭제할까요?' : '캐릭터 설정과 대화를 삭제할까요?'}</Text>
      <Text style={s.body}>{type === 'entries' ? '두 채팅방의 대화와 보관함의 지난 기록을 이 기기에서 지워요.' : '두 캐릭터의 프로필과 이미지, 대화와 지난 기록을 이 기기에서 지워요.'}</Text>
      {error ? <Notice danger>{error}</Notice> : null}
      <View style={s.formRow}><View style={s.flex}><Action kind="soft" onPress={onCancel} disabled={busy}>취소</Action></View>
        <View style={s.flex}><Action kind="danger" onPress={onConfirm} disabled={busy}>{busy ? '삭제 중…' : '삭제'}</Action></View></View>
    </View></View>
  </Modal>;
}

const demoStates = {
  none: ['오늘 기록이 없어요', '오늘 이야기를 나눈 날에 시그널을 받을 수 있어요.', '오늘은 잠겨 있어요'],
  early: ['오후 10시에 열려요', '오늘 나눈 이야기가 있어요. 오후 10시가 되면 시그널을 볼 수 있어요.', '아직 열 수 없어요'],
  night: ['시그널이 도착했어요', '오늘 이야기를 들은 캐릭터 중 누가 메시지를 보냈을까요?', '시그널 열기'],
};
const demoPeople = [{ name: '윤서', avatar: 'sol' }, { name: '하온', avatar: 'haon' }];
const demoLetter = '오늘 얘기해 준 문제 두 개, 기억할게. 하기 싫은 날에도 시작한 너한테 이 말을 꼭 해주고 싶었어.';

export function SignalPreview({ onBack }) {
  const [mode, setMode] = useState('night');
  const [step, setStep] = useState('arrived');
  const [guess, setGuess] = useState(null);
  const [title, caption, button] = demoStates[mode];
  return <View style={s.page}>
    <Header title={step === 'saved' ? '받은 시그널 예시' : '오늘의 시그널'} onBack={onBack} tag="후속안" />
    <View style={s.content}>
      <Text style={s.note}>예시 캐릭터와 기록으로 살펴보는 팀 검토용 화면이에요.</Text>
      {step !== 'saved' ? <>
        <Segment options={[[ 'none', '기록 없음' ], [ 'early', '오후 9시' ], [ 'night', '오후 10시' ]]} value={mode}
          onChange={next => { setMode(next); setStep('arrived'); setGuess(null); }} />
        <View style={s.night}><Orbit night /><Text style={s.nightTime}>PM 10:00</Text>
          <Text style={[s.title, s.whiteText]}>{title}</Text><Text style={s.nightCopy}>{caption}</Text></View>
      </> : null}
      {step === 'arrived' ? <Action icon="arrow" disabled={mode !== 'night'} onPress={() => setStep('guess')}>{button}</Action> : null}
      {step === 'guess' ? <View style={s.guess}>
        <Text style={s.title}>누가 보냈을까요?</Text>
        <View style={s.formRow}>{demoPeople.map((person, index) => <Pressable key={person.name} accessibilityRole="button" accessibilityLabel={person.name}
          style={s.guessChoice} onPress={() => { setGuess(index); setStep('result'); }}><Avatar person={person} size={42} /><Text style={s.label}>{person.name}</Text></Pressable>)}</View>
      </View> : null}
      {step === 'result' || step === 'saved' ? <View style={s.recordDetail}>
        <Text style={s.title}>보낸 사람 · 윤서</Text>
        {step === 'result' ? <Text style={s.note}>{guess === 0 ? '맞혔어요!' : '고른 캐릭터 · 하온'}</Text> : <Text style={s.note}>후속안 예시 · 오후 10:00</Text>}
        <Text style={s.messageText}>{demoLetter}</Text>
        <Action kind="soft" onPress={() => setStep(step === 'result' ? 'saved' : 'arrived')}>{step === 'result' ? '받은 시그널 예시 보기' : '시그널 다시 보기'}</Action>
      </View> : null}
    </View>
  </View>;
}
