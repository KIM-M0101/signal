import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, Easing, Image, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, Rect, Stop, SvgXml } from 'react-native-svg';
import { ART } from './art.js';
import {
  AVATARS, CHARACTER_COLORS, CHARACTER_GENDERS, MAX_DIARY, MAX_ENTRY, MAX_NOTE, MOODS, RELATIONS, STYLES, USER_GENDERS,
  countdown, dateLabel, greetingFor, josa, localDate, relationLabel, sampleLines, signalPreview, stageOf, statusLine, unreadCount,
} from './model.js';
import { BACKGROUNDS, backgroundOf, colors as C, styles as s } from './theme.js';

/** 사용자가 고른 낮 화면 배경색 (설정 → 화면). */
export const BackgroundContext = createContext(BACKGROUNDS[0]);
const useBackground = () => useContext(BackgroundContext);

/** 휴대폰의 '동작 줄이기'가 켜져 있으면 반짝임·하트 효과를 멈춘다. */
function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled?.().then(value => { if (active) setReduced(Boolean(value)); }).catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', value => setReduced(Boolean(value)));
    return () => { active = false; sub?.remove?.(); };
  }, []);
  return reduced;
}

// 별 위치는 매번 같게(시드 고정) 흩뿌린다.
const STARS = Array.from({ length: 46 }, (_, i) => {
  const r = n => { const x = Math.sin((i + 1) * 9301 + n * 49297) * 233280; return x - Math.floor(x); };
  return { left: `${(r(1) * 96 + 2).toFixed(1)}%`, top: `${(r(2) * 96 + 1).toFixed(1)}%`, size: r(3) < 0.18 ? 3 : r(3) < 0.55 ? 2 : 1.4, group: i % 3 };
});

/** 시그널 화면의 밤하늘: 반짝이는 별, 초승달, 가끔 지나가는 별똥별. */
export function StarrySky({ dense = true }) {
  const reduced = useReducedMotion();
  const twinkle = [useRef(new Animated.Value(1)).current, useRef(new Animated.Value(0.55)).current, useRef(new Animated.Value(0.8)).current];
  const shoot = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) return undefined;
    const loops = twinkle.map((value, i) => Animated.loop(Animated.sequence([
      Animated.timing(value, { toValue: 0.25, duration: 1400 + i * 500, easing: Easing.inOut(Easing.quad), useNativeDriver: native }),
      Animated.timing(value, { toValue: 1, duration: 1400 + i * 500, easing: Easing.inOut(Easing.quad), useNativeDriver: native }),
    ])));
    const meteor = Animated.loop(Animated.sequence([
      Animated.delay(3800),
      Animated.timing(shoot, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: native }),
      Animated.timing(shoot, { toValue: 0, duration: 0, useNativeDriver: native }),
      Animated.delay(2600),
    ]));
    loops.forEach(loop => loop.start());
    meteor.start();
    return () => { loops.forEach(loop => loop.stop()); meteor.stop(); };
  }, [reduced]);
  const stars = dense ? STARS : STARS.filter((_, i) => i % 2 === 0);
  return <View pointerEvents="none" style={s.sky} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    {stars.map((star, i) => <Animated.View key={i} style={[s.star, {
      left: star.left, top: star.top, width: star.size, height: star.size, opacity: reduced ? 0.8 : twinkle[star.group],
    }]} />)}
    <View style={s.moon}><Svg width={44} height={44} viewBox="0 0 44 44">
      <Circle cx="22" cy="22" r="17" fill="#FFE7A8" opacity={0.95} />
      <Circle cx="30" cy="16" r="15" fill={C.night} />
    </Svg></View>
    {!reduced ? <Animated.View style={[s.shooting, {
      opacity: shoot.interpolate({ inputRange: [0, 0.1, 0.8, 1], outputRange: [0, 1, 0.8, 0] }),
      transform: [{ translateX: shoot.interpolate({ inputRange: [0, 1], outputRange: [40, 320] }) },
        { translateY: shoot.interpolate({ inputRange: [0, 1], outputRange: [0, 110] }) }, { rotate: '19deg' }],
    }]}><Svg width={90} height={2}><Defs><LinearGradient id="meteor" x1="0" y1="0" x2="1" y2="0">
      <Stop offset="0" stopColor="#FFF6DA" stopOpacity="0" /><Stop offset="1" stopColor="#FFF6DA" stopOpacity="1" />
    </LinearGradient></Defs><Rect width={90} height={2} rx={1} fill="url(#meteor)" /></Svg></Animated.View> : null}
  </View>;
}

/** 보낸 사람을 맞혔을 때 하트가 터지듯 떠오르는 효과. */
function HeartBurst({ color }) {
  const reduced = useReducedMotion();
  const hearts = useRef(Array.from({ length: 14 }, (_, i) => ({
    value: new Animated.Value(0),
    x: Math.round(Math.cos((i / 14) * Math.PI * 2) * (70 + (i % 3) * 26)),
    y: Math.round(Math.sin((i / 14) * Math.PI * 2) * (50 + (i % 4) * 18)) - 60,
    size: 18 + (i % 4) * 5,
    tint: i % 3 === 0 ? C.star : i % 2 ? C.heart : color,
  }))).current;
  useEffect(() => {
    if (reduced) return;
    Animated.stagger(45, hearts.map(heart => Animated.timing(heart.value, {
      toValue: 1, duration: 1300, easing: Easing.out(Easing.cubic), useNativeDriver: native,
    }))).start();
  }, [reduced]);
  if (reduced) return null;
  return <View pointerEvents="none" style={s.burst} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    {hearts.map((heart, i) => <Animated.Text key={i} style={[s.burstHeart, { color: heart.tint, fontSize: heart.size,
      opacity: heart.value.interpolate({ inputRange: [0, 0.15, 0.7, 1], outputRange: [0, 1, 1, 0] }),
      transform: [
        { translateX: heart.value.interpolate({ inputRange: [0, 1], outputRange: [0, heart.x] }) },
        { translateY: heart.value.interpolate({ inputRange: [0, 1], outputRange: [10, heart.y] }) },
        { scale: heart.value.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.3, 1.25, 0.9] }) },
      ] }]}>♥</Animated.Text>)}
  </View>;
}

const icons = {
  chat: 'M21 11.5a8.5 8.5 0 0 1-8.5 8.5 9 9 0 0 1-3.5-.7L3 21l1.7-5.7a9 9 0 0 1-.7-3.8 8.5 8.5 0 0 1 17 0Z',
  book: 'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4Zm0 13a3 3 0 0 1 3-3h11M9 8h6',
  gear: 'M4 6h16M4 12h16M4 18h16',
  moon: 'M20 15a8 8 0 1 1-11-11 8 8 0 0 0 11 11ZM17 2v6m-3-3h6',
  arrow: 'M4 12h16m-6-6 6 6-6 6',
  up: 'M12 20V4m-6 6 6-6 6 6',
  back: 'm15 18-6-6 6-6',
  next: 'm9 18 6-6-6-6',
  down: 'm6 9 6 6 6-6',
  mail: 'M3 5h18v14H3zM3 6l9 7 9-7',
  shield: 'M12 22s8-3.6 8-11V5l-8-3-8 3v6c0 7.4 8 11 8 11Zm-3-10 2 2 4-4',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  pen: 'M4 20h4L19 9l-4-4L4 16v4Zm9-13 4 4',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
};
const time = new Intl.DateTimeFormat('ko-KR', { hour: 'numeric', minute: '2-digit' });
const shortDate = new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric' });
const destinations = [['house', '채팅', 'chat'], ['diaries', '일기', 'book'], ['signals', '시그널', 'mail'], ['settings', '설정', 'gear']];
const native = Platform.OS !== 'web';
const tone = id => CHARACTER_COLORS[id] ?? CHARACTER_COLORS.first;
const voice = person => `${person.style === '기타' ? person.styleCustom || '기타' : person.style} · ${person.casual ? '반말' : '존댓말'}`;

function Icon({ name, color = C.accent, size = 20, weight = 1.8 }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
    <Path d={icons[name]} fill="none" stroke={color} strokeWidth={name === 'more' ? 3 : weight} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>;
}

export function Action({ children, onPress, icon, kind = 'primary', disabled = false, label, color, small = false }) {
  const filled = kind === 'primary' || kind === 'danger';
  const textColor = filled ? C.paper : kind === 'nightSoft' ? C.nightText : color ?? C.accent;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [s.action, s[kind], small && s.smallAction, color && kind === 'primary' && { backgroundColor: color },
      disabled && s.disabled, pressed && s.pressed]}>
    <Text style={[s.actionText, small && s.smallActionText, { color: textColor }]}>{children}</Text>
    {icon ? <Icon name={icon} size={17} color={textColor} /> : null}
  </Pressable>;
}

export function Avatar({ person, size = 48, ring }) {
  // 테두리 두께만큼 안쪽 원을 줄여서, 사진이 원 안을 가운데 기준으로 꽉 채우게 한다.
  const line = ring ? 2 : 0;
  const inner = size - line * 2;
  const circle = { width: inner, height: inner, borderRadius: inner / 2 };
  return <View style={[s.avatar, { width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' },
    ring && { borderWidth: line, borderColor: ring }]} accessibilityElementsHidden>
    <View style={[circle, { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }]}>
      {person.photo ? <Image source={{ uri: person.photo }} resizeMode="cover" style={circle} />
        : <SvgXml xml={ART[person.avatar]} width={inner} height={inner} />}
    </View>
  </View>;
}

/** 입력창이 자기 글자를 먼저 들고 있다가 위로 알린다.
 *  저장이 늦게 끝나도 한글 조합 중인 글자가 덮어써지지 않게 한다(한 글자씩 끊기던 문제). */
function TextBox({ value, onChangeText, inputRef, onFocus, onBlur, ...props }) {
  const [text, setText] = useState(value ?? '');
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setText(value ?? ''); }, [value]);
  return <TextInput ref={inputRef} {...props} value={text}
    onChangeText={next => { setText(next); onChangeText?.(next); }}
    onFocus={event => { focused.current = true; onFocus?.(event); }}
    onBlur={event => { focused.current = false; onBlur?.(event); }} />;
}

/** 호감도: 단계 이름 + 진행 바 + 퍼센트. 내려가지 않는 관계의 깊이로 보여준다. */
export function HeartMeter({ value, id, night = false, compact = false }) {
  const stage = stageOf(value);
  const color = tone(id).main;
  return <View style={s.meter} accessibilityLabel={`호감도 ${value}퍼센트, ${stage.name}`}>
    <View style={s.rowBetween}>
      <Text style={[s.stageName, { color: night ? C.nightText : color }]}>{stage.name}</Text>
      <Text style={[s.heart, { color: night ? C.star : color }]}>♥ {value}%</Text>
    </View>
    <View style={[s.meterTrack, night && { backgroundColor: C.nightLine }]}>
      <View style={[s.meterFill, { width: `${Math.max(value, 2)}%`, backgroundColor: color }]} />
    </View>
    {!compact && stage.next ? <Text style={[s.note, night && s.nightMuted]}>'{stage.next}'까지 ♥ {stage.toNext}%</Text> : null}
  </View>;
}

function Brand({ night }) {
  return <View style={s.brand}><Text style={[s.brandMark, night && { backgroundColor: C.nightCard, color: C.star }]}>✦</Text>
    <Text style={[s.brandWord, night && { color: C.nightMuted }]}>HARU SIGNAL</Text></View>;
}

function Header({ title, onBack, tag, right, night = false }) {
  const ink = night ? C.nightText : C.ink;
  return <View style={[s.header, night && s.headerNight]}>
    {onBack ? <Pressable accessibilityRole="button" accessibilityLabel="뒤로" onPress={onBack} style={s.iconButton}>
      <Icon name="back" color={ink} size={24} />
    </Pressable> : <View style={{ width: 8 }} />}
    <Text accessibilityRole="header" style={[s.headerTitle, { color: ink }]} numberOfLines={1}>{title}</Text>
    {tag ? <Text style={s.tag}>{tag}</Text> : null}
    {right}
  </View>;
}

function Steps({ current }) {
  return <View style={s.steps} accessibilityLabel={`3단계 중 ${current}단계`}>
    {[1, 2, 3].map(step => <View key={step} style={[s.step, step <= current && s.stepOn]} />)}
  </View>;
}

export function Notice({ children, danger = false }) {
  return <View accessibilityLiveRegion="polite" style={[s.notice, danger && s.noticeDanger]}><Text style={[s.note, danger && s.dangerText]}>{children}</Text></View>;
}

function Segment({ options, value, onChange, disabled = false }) {
  return <View style={s.segment}>
    {options.map(([id, label, dot]) => <Pressable key={String(id)} accessibilityRole="button" accessibilityState={{ selected: id === value, disabled }}
      disabled={disabled} onPress={() => onChange(id)} style={[s.segmentButton, id === value && s.segmentActive]}>
      {dot ? <View style={[s.colorDot, { backgroundColor: dot }]} /> : null}
      <Text numberOfLines={1} style={id === value ? s.segmentLabel : s.segmentText}>{label}</Text>
    </Pressable>)}
  </View>;
}

function Chips({ options, value, onChange, disabled }) {
  return <View style={s.wrap}>
    {options.map(option => <Pressable key={option} accessibilityRole="radio" accessibilityState={{ checked: option === value, disabled }}
      disabled={disabled} onPress={() => onChange(option)} style={[s.chip, option === value && s.chipActive]}>
      <Text style={[s.chipText, option === value && s.chipLabel]}>{option}</Text>
    </Pressable>)}
  </View>;
}

export function Tabs({ route, onNavigate, disabled, badges = {} }) {
  return <View style={s.tabs} accessibilityRole="tablist">
    {destinations.map(([id, label, icon]) => {
      const active = id === route;
      return <Pressable key={id} accessibilityRole="tab" accessibilityLabel={label + (badges[id] ? `, 새 항목 ${badges[id]}개` : '')}
        accessibilityState={{ selected: active, disabled }} onPress={() => onNavigate(id)} disabled={disabled} style={s.tab}>
        <View><Icon name={icon} color={active ? C.accent : C.muted} />{badges[id] ? <View style={s.tabDot} /> : null}</View>
        <Text style={[s.tabLabel, active && s.tabActive]}>{label}</Text>
      </Pressable>;
    })}
  </View>;
}

function Orbit({ night = false, height = 194 }) {
  return <Svg width="100%" height={height} viewBox="0 0 296 192" accessible={false}>
    <Defs><LinearGradient id={night ? 'orbit-night' : 'orbit-day'} x1="0" y1="0" x2="1" y2="1">
      <Stop offset="0" stopColor={night ? '#9C7BE0' : '#B494E3'} /><Stop offset="1" stopColor={night ? '#5B3FA8' : '#7750B4'} /></LinearGradient></Defs>
    <Ellipse cx="147" cy="96" rx="113" ry="52" rotation="-24" originX="147" originY="96" fill="none" stroke={night ? '#6E5FB0' : '#C6ABEA'} opacity={0.7} />
    <Ellipse cx="147" cy="96" rx="123" ry="62" rotation="22" originX="147" originY="96" fill="none" stroke={night ? '#4C4290' : '#E2D2F5'} />
    <Path d="M216 32l3 8 8 3-8 3-3 8-3-8-8-3 8-3zm-154 87 2 6 6 2-6 2-2 6-2-6-6-2 6-2z" fill={night ? C.star : '#E9A3C0'} />
    <Path d="M116 58h58a21 21 0 0 1 21 21v31a21 21 0 0 1-21 21h-40l-18 11v-11a21 21 0 0 1-21-21V79a21 21 0 0 1 21-21Z" fill={`url(#${night ? 'orbit-night' : 'orbit-day'})`} />
    {night ? <Path d="M126 82h42v27h-42zm0 1 21 16 21-16" fill="none" stroke="#FFFFFF" strokeWidth={2.5} strokeLinejoin="round" />
      : <Path d="M147 111s-20-11-20-23a10 10 0 0 1 20-3 10 10 0 0 1 20 3c0 12-20 23-20 23Z" fill="none" stroke="#FFFFFF" strokeWidth={2.5} />}
  </Svg>;
}

function Field({ label, value, onChangeText, limit, placeholder, multiline, required, error, secure, inputRef, hint, right, half }) {
  return <View style={[s.field, half && s.half]}>
    <View style={s.labelRow}>
      <Text style={s.label}>{label}</Text>
      <Text style={required ? s.required : s.optional}>{required ? '필수' : '선택'}</Text>
    </View>
    <View style={s.row}>
      <TextBox inputRef={inputRef} accessibilityLabel={label} value={value} onChangeText={onChangeText} maxLength={limit} placeholder={placeholder}
        placeholderTextColor="#A39BB2" multiline={multiline} secureTextEntry={secure} autoCapitalize="none"
        style={[s.input, s.flex, multiline && s.textarea, error && s.inputError]} />
      {right}
    </View>
    {hint ? <Text style={s.note}>{hint}</Text> : null}
    {error ? <Text accessibilityLiveRegion="polite" style={s.dangerText}>{error}</Text> : null}
  </View>;
}

function ChoiceGroup({ label, required = false, children }) {
  return <View style={s.field}>
    <View style={s.labelRow}><Text style={s.label}>{label}</Text><Text style={required ? s.required : s.optional}>{required ? '필수' : '선택'}</Text></View>
    {children}
  </View>;
}

function PasswordToggle({ visible, onToggle }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={visible ? '비밀번호 숨기기' : '비밀번호 표시'}
    onPress={onToggle} style={s.iconButton}><Icon name="eye" color={visible ? C.accent : C.muted} /></Pressable>;
}

// 1. 첫 진입
export function Intro({ hasPending, onStart, onResume, onLogin, onPrivacy, notice }) {
  return <View style={s.intro}>
    {notice ? <Notice>{notice}</Notice> : null}
    <View style={s.introArt}><Orbit /></View>
    <Brand />
    <Text accessibilityRole="header" style={s.introTitle}>하루시그널</Text>
    <Text style={s.body}>하루의 이야기를 남기면, 상대방이 보내는 시그널을 만나요.</Text>
    {hasPending ? <Action icon="arrow" onPress={onResume}>이어서 설정하기</Action> : null}
    <Action icon={hasPending ? undefined : 'arrow'} kind={hasPending ? 'soft' : 'primary'} onPress={onStart}>
      {hasPending ? '처음부터 시작하기' : '바로 시작하기'}</Action>
    <Action kind="soft" onPress={onLogin}>로그인</Action>
    <Pressable accessibilityRole="link" onPress={onPrivacy} style={s.linkButton}><Text style={s.link}>개인정보 안내</Text></Pressable>
  </View>;
}

// 2. 로그인
export function Login({ onSubmit, onStart, onBack, errors = {}, failed, busy }) {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  return <View style={s.page}>
    <Header title="로그인" onBack={onBack} />
    <View style={s.content}>
      <Notice>하루시그널 계정은 이 기기(브라우저)에만 저장돼요. 다른 기기에서 만든 계정으로는 로그인할 수 없어요.</Notice>
      <Field label="아이디" required value={loginId} onChangeText={setLoginId} limit={20} error={errors.loginId} />
      <Field label="비밀번호" required value={password} onChangeText={setPassword} limit={64} secure={!visible} error={errors.password}
        right={<PasswordToggle visible={visible} onToggle={() => setVisible(!visible)} />} />
      {failed ? <Notice danger>{failed}</Notice> : null}
      <Action disabled={busy} onPress={() => onSubmit({ loginId, password })}>{busy ? '로그인 중…' : '로그인'}</Action>
      <Pressable accessibilityRole="link" onPress={onStart} style={s.linkButton}><Text style={s.link}>처음이신가요? 바로 시작하기</Text></Pressable>
    </View>
  </View>;
}

// 3. 내 프로필
export function ProfileForm({ value, onChange, onNext, onBack, errors = {}, busy, editing = false, error, guest = false, onRegister }) {
  const nameRef = useRef(null);
  useEffect(() => { if (errors.nickname) nameRef.current?.focus?.(); }, [errors.nickname]);
  return <View style={s.page}>
    <Header title="내 프로필" onBack={onBack} />
    <View style={s.content}>
      {!editing ? <><Steps current={1} /><Text style={s.display}>먼저, 나를 알려주세요.</Text></> : null}
      <Text style={s.note}>상대방이 대화에서 참고할 정보예요. 이름만 꼭 적고, 나머지는 건너뛰어도 돼요.</Text>
      {editing && guest ? <View style={s.cardSection}>
        <Text style={s.label}>로그인 계정이 아직 없어요</Text>
        <Text style={s.note}>계정을 만들면 로그아웃한 뒤에도 이 아이디로 다시 들어올 수 있어요. 지금까지의 기록은 그대로 이어져요.</Text>
        <Action small kind="soft" onPress={onRegister} disabled={busy}>로그인 계정 만들기</Action>
      </View> : null}
      <Field inputRef={nameRef} label="이름(닉네임)" required value={value.nickname} onChangeText={nickname => onChange({ nickname })}
        limit={16} error={errors.nickname} placeholder="상대방이 부를 이름" />
      <Field label="좋아하는 것" value={value.likes} onChangeText={likes => onChange({ likes })} limit={MAX_NOTE}
        placeholder="예: 고양이, 산책, 잔잔한 음악" multiline />
      <Field label="싫어하는 것" value={value.dislikes} onChangeText={dislikes => onChange({ dislikes })} limit={MAX_NOTE}
        placeholder="예: 갑작스러운 조언, 놀리는 말투" multiline />
      <Field label="MBTI" value={value.mbti} onChangeText={mbti => onChange({ mbti })} limit={12} placeholder="자유롭게 적어 주세요" />
      <ChoiceGroup label="성별">
        <Chips options={USER_GENDERS} value={value.gender} onChange={gender => onChange({ gender })} disabled={busy} />
      </ChoiceGroup>
      {error ? <Notice danger>{error}</Notice> : null}
      <View style={s.formRow}>
        <View style={s.flex}><Action kind="soft" onPress={onBack} disabled={busy}>이전</Action></View>
        <View style={s.flex}><Action onPress={onNext} disabled={busy} icon={editing ? undefined : 'arrow'}>{editing ? '저장' : '다음'}</Action></View>
      </View>
    </View>
  </View>;
}

// 4. 상대방 프로필
export function CharacterSetup({
  draft, index, done, onChoose, onChange, onPickPhoto, onComplete, onFinish, onBack, editing, onboarding, busy, errors = {}, error, finishLabel,
}) {
  const [avatarsOpen, setAvatarsOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const person = draft[index];
  const color = tone(person.id);
  const bothDone = done.every(Boolean);
  const lines = sampleLines(person);
  useEffect(() => { setAvatarsOpen(false); }, [index]);
  return <View style={s.page}>
    <Header title="상대방 프로필" onBack={onBack} />
    <View style={s.content}>
      {onboarding ? <><Steps current={2} /><Text style={s.display}>대화할 상대방을 알려주세요.</Text></> : null}
      {!editing ? <Segment value={index} disabled={busy} onChange={onChoose}
        options={draft.map((item, i) => [i, `${item.name || `상대방 ${i + 1}`}${done[i] ? ' ✓' : ''}`, tone(item.id).main])} /> : null}
      <View style={s.photoRow}>
        <Avatar person={person} size={72} ring={color.main} />
        <View style={[s.flex, { gap: 8 }]}>
          <Text style={s.label}>아바타</Text>
          <View style={s.wrap}>
            <Action small kind="soft" onPress={() => setAvatarsOpen(!avatarsOpen)} disabled={busy}>기본 아바타</Action>
            <Action small kind="soft" onPress={onPickPhoto} disabled={busy}>사진 등록 · 선택</Action>
          </View>
        </View>
      </View>
      {avatarsOpen ? <View style={s.wrap}>
        {AVATARS.map(avatar => <Pressable key={avatar.id} accessibilityRole="button" accessibilityLabel={avatar.label}
          accessibilityState={{ selected: person.avatar === avatar.id && !person.photo }}
          style={[s.avatarOption, person.avatar === avatar.id && !person.photo && s.avatarSelected]}
          onPress={() => { onChange({ avatar: avatar.id, photo: '' }); setAvatarsOpen(false); }}>
          <Avatar person={{ avatar: avatar.id }} size={44} />
        </Pressable>)}
      </View> : null}
      <View style={s.formRow}>
        <Field half label="이름" required value={person.name} onChangeText={name => onChange({ name })} limit={16} error={errors.name} placeholder="예: 윤서" />
        <Field half label="나를 부를 호칭" required value={person.address} onChangeText={address => onChange({ address })} limit={16}
          placeholder="예: 지우야" error={errors.address} />
      </View>
      <ChoiceGroup label="관계" required>
        <Chips options={RELATIONS} value={person.relation} onChange={relation => onChange({ relation })} disabled={busy} />
        {person.relation === '기타' ? <TextBox accessibilityLabel="관계 직접 입력" value={person.relationCustom} maxLength={16}
          onChangeText={relationCustom => onChange({ relationCustom })} style={s.input} placeholder="직접 입력" placeholderTextColor="#A39BB2" /> : null}
      </ChoiceGroup>
      <ChoiceGroup label="대화 방식" required>
        <Chips options={STYLES} value={person.style} onChange={style => onChange({ style })} disabled={busy} />
        {person.style === '기타' ? <Field label="원하는 대화 방식" required value={person.styleCustom}
          onChangeText={styleCustom => onChange({ styleCustom })} limit={MAX_NOTE} multiline error={errors.styleCustom}
          placeholder="예: 짧고 차분하게 이야기해 주세요" /> : null}
      </ChoiceGroup>
      <ChoiceGroup label="반말 모드" required>
        <Segment value={person.casual} disabled={busy} onChange={casual => onChange({ casual })} options={[[true, '켜기'], [false, '끄기']]} />
      </ChoiceGroup>

      <View style={[s.preview, { backgroundColor: color.soft, borderColor: color.border }]} accessibilityLabel="말투 미리보기">
        <Text style={[s.previewTitle, { color: color.main }]}>이 상대방은 이렇게 말해요</Text>
        {lines.map(line => <View key={line} style={s.reaction}>
          <Avatar person={person} size={28} />
          <View style={[s.bubble, { backgroundColor: C.paper, borderColor: color.border, maxWidth: '86%' }]}><Text style={s.messageText}>{line}</Text></View>
        </View>)}
      </View>

      <Pressable accessibilityRole="button" accessibilityState={{ expanded: moreOpen }} onPress={() => setMoreOpen(!moreOpen)} style={s.more}>
        <Text style={s.segmentLabel}>{moreOpen ? '추가 설정 접기' : '더 설정하기 · 성별, MBTI, 맞춰줬으면 하는 점'}</Text>
        <Icon name="down" size={16} />
      </Pressable>
      {moreOpen ? <>
        <ChoiceGroup label="성별">
          <Chips options={CHARACTER_GENDERS} value={person.gender} onChange={gender => onChange({ gender })} disabled={busy} />
        </ChoiceGroup>
        <Field label="MBTI" value={person.mbti} onChangeText={mbti => onChange({ mbti })} limit={12} placeholder="자유롭게 적어 주세요" />
        <Field label="나에게 맞춰줬으면 하는 점" value={person.preference} onChangeText={preference => onChange({ preference })}
          limit={MAX_NOTE} multiline placeholder={'예: 힘들 땐 해결책보다 먼저 공감해 주세요.\n예: 기분이 좋아 보일 때는 같이 신나게 반응해 주세요.'} />
      </> : null}
      <Text style={s.note}>사진은 이 기기에만 저장하고 AI로 보내지 않아요. 실제 사람 사진 대신 합성 이미지나 그림을 써 주세요.</Text>
      {error ? <Notice danger>{error}</Notice> : null}
      {editing ? <Action onPress={onComplete} disabled={busy}>저장</Action> : <>
        <Action kind={bothDone ? 'soft' : 'primary'} color={bothDone ? color.main : undefined} onPress={onComplete} disabled={busy}>
          {`상대방 ${index + 1} 프로필 완료`}</Action>
        <Action kind={bothDone ? 'primary' : 'soft'} disabled={!bothDone || busy} onPress={onFinish} icon={bothDone ? 'arrow' : undefined}>
          {bothDone ? finishLabel : '두 상대방 설정을 완료하면 다음으로 갈 수 있어요'}</Action>
      </>}
    </View>
  </View>;
}

// 3-1. 계정 만들기: 온보딩 마지막 단계(건너뛸 수 있음) 또는 나중에 설정에서
export function AccountForm({ characters, onSubmit, onGuest, onBack, errors = {}, busy, error, register = false }) {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  return <View style={s.page}>
    <Header title={register ? '로그인 계정 만들기' : '계정 만들기'} onBack={onBack} />
    <View style={s.content}>
      {register ? <Text style={s.display}>로그인 계정을 만들어요.</Text>
        : <><Steps current={3} /><Text style={s.display}>상대방 프로필을 저장할게요.</Text></>}
      <View style={[s.card, s.row]}>
        <View style={s.row}>{characters.map(person => <Avatar key={person.id} person={person} size={44} ring={tone(person.id).main} />)}</View>
        <Text style={[s.body, s.flex]}>{register ? '지금까지의 프로필, 상대방 프로필, 일기와 시그널은 그대로 이어져요.'
          : `${josa(characters[0].name, '과', '와')} ${josa(characters[1].name, '이', '가')} 채팅방에서 기다리고 있어요.`}</Text>
      </View>
      <Notice>계정은 이 기기(브라우저)에만 저장돼요. 계정을 만들어 두면 로그아웃해도 이 아이디로 다시 들어올 수 있어요.</Notice>
      <Field label="아이디" required value={loginId} onChangeText={setLoginId} limit={20} placeholder="영문 소문자·숫자 4~20자" error={errors.loginId} />
      <Field label="비밀번호" required value={password} onChangeText={setPassword} limit={64} secure={!visible} placeholder="6자 이상"
        error={errors.password} right={<PasswordToggle visible={visible} onToggle={() => setVisible(!visible)} />} />
      {error ? <Notice danger>{error}</Notice> : null}
      <Action icon="arrow" disabled={busy} onPress={() => onSubmit({ loginId, password })}>
        {busy ? '저장하는 중…' : register ? '계정 만들기' : '계정 만들고 채팅방으로'}</Action>
      {!register ? <>
        <Action kind="soft" disabled={busy} onPress={onGuest}>계정 없이 시작하기</Action>
        <Text style={s.note}>계정 없이 시작해도 모든 기능을 쓸 수 있어요. 나중에 설정 → 내 프로필에서 계정을 만들 수 있어요.</Text>
      </> : null}
    </View>
  </View>;
}

// 5. 우리 채팅방
export function Home({
  profile, characters, affinity, threads, readThrough, todayDiary, todaySignal, now, night = false, onOpenRoom, onDiary, onSignals, onOpenSignal, onSettings,
}) {
  const today = localDate(now);
  const background = useBackground();
  return <View style={s.page}>
    <View style={[s.hero, { backgroundColor: background.page }, night && s.heroNight]}>
      <View style={s.rowBetween}><Brand night={night} />
        <Pressable accessibilityRole="button" accessibilityLabel="프로필·상대방 설정" onPress={onSettings} style={s.iconButton}>
          <Icon name="gear" color={night ? C.nightText : C.ink} /></Pressable>
      </View>
      <Text style={[s.note, night && s.nightMuted]}>{profile.nickname}님, {greetingFor(now)}</Text>
      <Text accessibilityRole="header" style={[s.heroTitle, night && s.nightText]}>우리 채팅방</Text>
    </View>
    <TodayCard today={today} diary={todayDiary} signal={todaySignal} now={now} night={night}
      onDiary={onDiary} onSignals={onSignals} onOpenSignal={onOpenSignal} />
    <Text style={s.sectionTitle}>상대방</Text>
    <View style={s.rooms}>
      {characters.map(person => {
        const messages = (threads[person.id] ?? []).filter(message => message.source !== 'diary');
        const last = messages.at(-1);
        const unread = unreadCount(messages, readThrough[person.id]);
        const color = tone(person.id);
        return <Pressable key={person.id} accessibilityRole="button"
          accessibilityLabel={person.name + ' 채팅 열기' + (unread ? ', 읽지 않은 메시지 ' + unread + '개' : '')}
          onPress={() => onOpenRoom(person.id)} style={({ pressed }) => [s.characterCard, { borderColor: unread ? color.main : C.border }, pressed && s.pressed]}>
          <View style={s.row}>
            <Avatar person={person} size={64} ring={color.main} />
            <View style={[s.flex, { gap: 2 }]}>
              <View style={s.rowBetween}>
                <Text style={s.peerName} numberOfLines={1}>{person.name} <Text style={s.note}>· {relationLabel(person)}</Text></Text>
                {unread > 0 ? <Text style={[s.badge, { backgroundColor: color.main }]}>{unread > 99 ? '99+' : unread}</Text>
                  : last ? <Text style={s.timestamp}>{localDate(new Date(last.createdAt)) === today ? time.format(new Date(last.createdAt)) : shortDate.format(new Date(last.createdAt))}</Text> : null}
              </View>
              <Text numberOfLines={1} style={s.note}>{last ? (last.role === 'user' ? '나 · ' : '') + last.text : '아직 나눈 대화가 없어요.'}</Text>
            </View>
          </View>
          <HeartMeter value={affinity[person.id] ?? 0} id={person.id} compact />
          <View style={[s.status, { backgroundColor: color.soft }]}>
            <Text style={{ fontSize: 13 }}>💬</Text><Text style={[s.note, { color: color.main }]} numberOfLines={1}>{statusLine(person, now)}</Text>
          </View>
        </Pressable>;
      })}
    </View>
  </View>;
}

function TodayCard({ today, diary, signal, now, night, onDiary, onSignals, onOpenSignal }) {
  const written = diary && !diary.deleted;
  const ink = night ? s.nightText : null;
  const muted = night ? s.nightMuted : null;
  let body;
  if (signal && !signal.read) {
    body = <>
      <View style={s.row}><Text style={s.todayEmoji}>💌</Text>
        <View style={s.flex}><Text style={[s.title, ink]}>오늘의 시그널이 도착했어요</Text>
          <Text style={[s.note, muted]}>누가 보냈는지 열어볼까요?</Text></View></View>
      <Action icon="mail" onPress={() => onOpenSignal(signal.id)}>봉투 열기</Action>
    </>;
  } else if (signal) {
    body = <View style={s.row}><Text style={s.todayEmoji}>{diary?.emoji ?? '💌'}</Text>
      <View style={s.flex}><Text style={[s.title, ink]}>오늘의 시그널을 받았어요</Text>
        <Text style={[s.note, muted]}>내일도 하루 이야기를 기다릴게요.</Text></View>
      <Action small kind={night ? 'nightSoft' : 'soft'} onPress={onSignals}>보관함</Action></View>;
  } else if (written && diary.kind !== 'safety') {
    body = <>
      <View style={s.row}><Text style={s.todayEmoji}>{diary.emoji}</Text>
        <View style={s.flex}><Text style={[s.note, muted]}>오늘 일기를 남겼어요 · 시그널 도착까지</Text>
          <Text style={[s.countdown, night && { color: C.star }]}>{countdown(today, now)}</Text></View></View>
      <Action kind={night ? 'nightSoft' : 'soft'} onPress={onDiary}>오늘 남긴 일기 보기</Action>
    </>;
  } else if (diary) {
    body = <><View style={s.row}><Text style={s.todayEmoji}>{diary.deleted ? '📔' : diary.emoji}</Text>
      <View style={s.flex}><Text style={[s.title, ink]}>{diary.deleted ? '오늘 일기는 삭제했어요' : '오늘 이야기를 남겨줘서 고마워요'}</Text>
        <Text style={[s.note, muted]}>{diary.deleted ? '내일 다시 남길 수 있어요.' : '오늘은 시그널 대신 안전 안내를 먼저 확인해 주세요.'}</Text></View></View>
      {!diary.deleted ? <Action kind={night ? 'nightSoft' : 'soft'} onPress={onDiary}>오늘 남긴 일기 보기</Action> : null}</>;
  } else {
    body = <>
      <View style={s.row}><Text style={s.todayEmoji}>📔</Text>
        <View style={s.flex}><Text style={[s.title, ink]}>오늘 하루는 어땠나요?</Text>
          <Text style={[s.note, muted]}>일기나 대화를 남기면 밤 10시에 두 상대방 중 한 명이 시그널을 보내요.</Text></View></View>
      <Action icon="pen" onPress={onDiary}>오늘의 일기 쓰기</Action>
    </>;
  }
  return <View style={[s.today, night && s.todayNight]}>
    <Text style={[s.sectionDate, muted]}>{dateLabel(today)}</Text>
    {body}
  </View>;
}

// 5-1. 1:1 채팅방
export function Chat({
  person, affinity, messages, value, onChange, onSend, onBack, onEdit, pending, error, connection, usage, onBazeNotice,
  unreadSignals, onDiary, onSignals,
}) {
  const list = useRef(null);
  const nearEnd = useRef(true);
  const [focused, setFocused] = useState(false);
  const color = tone(person.id);
  const visibleMessages = messages.filter(message => message.source !== 'diary');
  const last = visibleMessages.filter(message => message.source !== 'stage').at(-1);
  const unanswered = last?.role === 'user';
  const scrollToEnd = () => { if (nearEnd.current) list.current?.scrollToEnd({ animated: false }); };
  useEffect(scrollToEnd, [pending]);
  function send() {
    nearEnd.current = true;
    onSend(value);
  }
  return <View style={s.chat}>
    <View style={s.chatHeader}>
      <Pressable accessibilityRole="button" accessibilityLabel="채팅방 목록으로" onPress={onBack} style={s.iconButton}>
        <Icon name="back" color={C.ink} size={24} />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={person.name + ' 프로필 편집'} onPress={onEdit} style={s.chatProfile}>
        <Avatar person={person} size={40} ring={color.main} />
        <View style={s.flex}><Text accessibilityRole="header" style={[s.label, { fontSize: 16.5 }]} numberOfLines={1}>{person.name}</Text>
          <Text style={[s.heart, { color: color.main }]}>{stageOf(affinity).name} · ♥ {affinity}%</Text></View>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="오늘의 일기" onPress={onDiary} style={s.iconButton}><Icon name="pen" color={C.ink} /></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={'시그널 보관함' + (unreadSignals ? `, 새 시그널 ${unreadSignals}개` : '')} onPress={onSignals} style={s.iconButton}>
        <Icon name="mail" color={C.ink} />{unreadSignals ? <View style={s.dot} /> : null}</Pressable>
    </View>
    {connection.provider === 'baze' ? <View style={[s.connection, s.bazeStatus]}>
      <View style={s.flex}>
        <Text style={s.note}>{connection.available ? '베이즈 · GPT-6 Luna · 테스트' : '베이즈 테스트 서버에 연결할 수 없어요.'}</Text>
        {usage ? <Text style={s.note}>최근 답장 · 입력 {usage.input} / 출력 {usage.output}토큰</Text> : null}
      </View>
      <Pressable accessibilityRole="button" style={s.bazeInfoButton} onPress={onBazeNotice}><Text style={s.segmentLabel}>전송 안내</Text></Pressable>
    </View> : connection.available === false ? <View style={s.connection}><Text style={s.note}>로컬 AI 서버에 연결할 수 없어요. 서버를 켜면 답장을 받을 수 있어요.</Text></View> : null}
    <ScrollView ref={list} style={s.flex} contentContainerStyle={s.messages} onContentSizeChange={scrollToEnd}
      onLayout={scrollToEnd} onScroll={({ nativeEvent: { contentSize, layoutMeasurement, contentOffset } }) => {
        nearEnd.current = contentSize.height - layoutMeasurement.height - contentOffset.y < 100;
      }} scrollEventThrottle={32} keyboardShouldPersistTaps="handled">
      {visibleMessages.length === 0 ? <Text style={s.emptyMessage}>오늘 해낸 일이나 마음에 남은 이야기를 들려줘요.</Text> : null}
      {visibleMessages.map((message, index) => {
        const date = new Date(message.createdAt);
        const day = localDate(date);
        const previous = visibleMessages[index - 1];
        const newDay = !previous || day !== localDate(new Date(previous.createdAt));
        const mine = message.role === 'user';
        const safety = message.source === 'safety' || message.safety;
        if (message.source === 'stage') {
          return <React.Fragment key={message.id}>
            {newDay ? <Text style={s.dateChip}>{dateLabel(day)}</Text> : null}
            <View style={[s.stageChip, { backgroundColor: color.soft, borderColor: color.border }]}>
              <Text style={[s.stageName, { color: color.main }]}>♥ '{message.stage}'{josa(message.stage, '이', '가').slice(-1)} 되었어요</Text>
              <Text style={[s.messageText, { textAlign: 'center' }]}>{message.text}</Text>
            </View>
          </React.Fragment>;
        }
        return <React.Fragment key={message.id}>
          {newDay ? <Text style={s.dateChip}>{dateLabel(day)}</Text> : null}
          <View style={[s.messageRow, mine && s.mine]}>
            {!mine ? <Avatar person={person} size={32} /> : null}
            {mine ? <Text style={s.timestamp}>{time.format(date)}</Text> : null}
            <View style={s.messageColumn}>
              <View style={[s.bubble, { backgroundColor: color.soft, borderColor: color.border }, mine && s.mineBubble, safety && s.safetyBubble]}>
                {safety ? <Text style={s.label}>안전 안내</Text> : null}
                <Text style={[s.messageText, mine && s.mineText]}>{message.text}</Text>
              </View>
            </View>
            {!mine ? <Text style={s.timestamp}>{time.format(date)}</Text> : null}
          </View>
        </React.Fragment>;
      })}
      {pending ? <View style={s.reaction} accessibilityLiveRegion="polite"><Avatar person={person} size={32} /><Typing /></View> : null}
      {!pending && (error || unanswered) ? <View style={s.retry} accessibilityLiveRegion="polite">
        <Text style={[s.note, s.flex]}>{error || '아직 답장이 도착하지 않았어요.'}</Text>
        {unanswered ? <Pressable accessibilityRole="button" onPress={() => onSend(last.text, last.id)} style={s.retryButton}>
          <Text style={s.dangerText}>다시 시도</Text></Pressable> : null}
      </View> : null}
    </ScrollView>
    <View style={[s.composer, focused && s.composerFocused]}>
      <TextInput accessibilityLabel="메시지" multiline numberOfLines={1} value={value} maxLength={MAX_ENTRY} onChangeText={onChange}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={s.chatInput} placeholder={`${person.name}에게 오늘 있었던 일을 들려줘요`} placeholderTextColor="#A39BB2" />
      <Pressable accessibilityRole="button" accessibilityLabel="메시지 보내기"
        accessibilityState={{ disabled: pending || !value.trim() }} disabled={pending || !value.trim()}
        style={[s.send, (pending || !value.trim()) && s.disabled]} onPress={send}>
        <Icon name="up" color={C.paper} size={20} />
      </Pressable>
    </View>
  </View>;
}

function Typing() {
  const dots = [useRef(new Animated.Value(0.3)).current, useRef(new Animated.Value(0.3)).current, useRef(new Animated.Value(0.3)).current];
  useEffect(() => {
    const loop = Animated.loop(Animated.stagger(160, dots.map(dot => Animated.sequence([
      Animated.timing(dot, { toValue: 1, duration: 280, useNativeDriver: native }),
      Animated.timing(dot, { toValue: 0.3, duration: 280, useNativeDriver: native }),
    ]))));
    loop.start();
    return () => loop.stop();
  }, []);
  return <View style={s.typing} accessibilityLabel="입력 중">
    {dots.map((dot, i) => <Animated.View key={i} style={[s.typingDot, { opacity: dot }]} />)}
  </View>;
}

// 6. 오늘의 일기
export function DiaryWrite({ date, value, onChange, onSubmit, onBack, errors = {}, busy, error, editing }) {
  const mood = MOODS.find(item => item.emoji === value.emoji);
  return <View style={s.page}>
    <Header title="오늘의 일기" onBack={onBack} tag={editing ? '수정 중' : undefined} />
    <View style={s.content}>
      <Text style={s.sectionDate}>{dateLabel(date)}</Text>
      <ChoiceGroup label="오늘의 감정" required>
        <View style={s.moods}>
          {MOODS.map(item => <Pressable key={item.emoji} accessibilityRole="radio" accessibilityLabel={item.label}
            accessibilityState={{ checked: value.emoji === item.emoji, disabled: busy }} disabled={busy}
            onPress={() => onChange({ emoji: item.emoji })} style={[s.mood, value.emoji === item.emoji && s.moodActive, errors.emoji && s.moodError]}>
            <Text style={s.moodEmoji}>{item.emoji}</Text>
            <Text style={[s.moodLabel, value.emoji === item.emoji && s.chipLabel]}>{item.label.replace(' ', '\n')}</Text>
          </Pressable>)}
        </View>
        {errors.emoji ? <Text accessibilityLiveRegion="polite" style={s.dangerText}>{errors.emoji}</Text> : null}
      </ChoiceGroup>
      <Text style={s.question}>{mood ? mood.question : '오늘 어떤 일이 있었나요?'}</Text>
      <Field label="오늘의 이야기" required value={value.text} onChangeText={text => onChange({ text })} limit={MAX_DIARY}
        placeholder="오늘 어떤 일이 있었나요?" multiline error={errors.text} hint={`${value.text.length} / ${MAX_DIARY}자 · 하루에 한 번 남길 수 있어요.`} />
      {busy ? <View style={s.wait}><ActivityIndicator color={C.accent} size="small" /><Text style={s.note}>일기를 저장하고 있어요.</Text></View> : null}
      {error ? <Notice danger>{error}</Notice> : null}
      <Action icon="pen" disabled={busy} onPress={onSubmit}>{editing ? '수정해서 다시 남기기' : '일기 남기기'}</Action>
      <Action kind="ghost" disabled={busy} onPress={onBack}>{editing ? '수정 취소' : '채팅방으로'}</Action>
    </View>
  </View>;
}

// 7. 일기 결과: 오늘의 한마디와 상대방별 응원을 일기 화면에서 보여준다.
export function DiaryResult({ diary, characters, generating, fresh, isToday, onChat, onEdit, onDelete, onRetry, onBack, error }) {
  const ready = ['done', 'safety'].includes(diary.status);
  const [shown, setShown] = useState(fresh ? 0 : 3);
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    if (!ready) return undefined;
    if (shown >= 3) return undefined;
    const timer = setTimeout(() => setShown(value => value + 1), shown === 0 ? 300 : 1100);
    return () => clearTimeout(timer);
  }, [ready, shown]);
  useEffect(() => { if (!ready) setShown(fresh ? 0 : 3); }, [ready]);
  const deleted = diary.deleted;
  const canEdit = isToday && !deleted;
  return <View style={s.page}>
    <Header title={isToday ? '오늘의 일기' : '지난 일기'} onBack={onBack}
      right={canEdit ? <Pressable accessibilityRole="button" accessibilityLabel="일기 메뉴" onPress={() => setMenu(true)} style={s.iconButton}
        disabled={generating}><Icon name="more" color={C.ink} /></Pressable> : null} />
    <View style={s.content}>
      {deleted ? <Notice>이 날의 일기는 삭제했어요. 같은 날짜에는 새 일기를 남길 수 없어요.</Notice> : <>
        <View style={s.diaryPaper}>
          <View style={s.rowBetween}><Text style={s.sectionDate}>{dateLabel(diary.date)}</Text><Text style={s.moodBig}>{diary.emoji}</Text></View>
          <Text style={s.body}>{diary.text}</Text>
        </View>
        {generating || diary.status === 'pending' ? <View style={s.wait} accessibilityLiveRegion="polite">
          <ActivityIndicator color={C.accent} size="small" /><Text style={s.note}>오늘의 이야기를 읽고 있어요.</Text></View> : null}
        {!generating && diary.status === 'failed' ? <View style={s.recordDetail}>
          <Text style={s.body}>오늘의 이야기를 남겨줘서 고마워요. 응원 메시지를 불러오지 못했지만 일기는 저장됐어요.</Text>
          {error ? <Text style={s.note}>{error}</Text> : null}
          <Action kind="soft" onPress={onRetry}>응원 메시지 다시 불러오기</Action>
        </View> : null}
        {ready && shown >= 1 ? <View style={s.commentCard} accessibilityLiveRegion="polite">
          <Text style={s.segmentLabel}>{diary.status === 'safety' ? '안전 안내' : '✦ 오늘의 한마디'}</Text>
          <Text style={s.body}>{diary.comment}</Text>
        </View> : null}
        {ready ? characters.map((person, index) => {
          const color = tone(person.id);
          if (shown < index + 2) return shown === index + 1 ? <View key={person.id} style={s.reaction}><Avatar person={person} size={36} /><Typing /></View> : null;
          return <View key={person.id} style={s.reaction} accessibilityLiveRegion="polite">
            <Avatar person={person} size={36} ring={color.main} />
            <View style={s.messageColumn}>
              <Text style={[s.diaryTag, { color: color.main }]}>{person.name}</Text>
              <View style={[s.bubble, { backgroundColor: color.soft, borderColor: color.border }]}><Text style={s.messageText}>{diary.reactions[index]}</Text></View>
            </View>
          </View>;
        }) : null}
      </>}
      <Action icon="chat" onPress={onChat}>채팅방으로</Action>
      {!isToday && !deleted ? <Text style={s.note}>지난 날짜의 일기는 볼 수만 있어요. 삭제는 설정의 기록 삭제에서 할 수 있어요.</Text> : null}
    </View>
    <MenuSheet visible={menu} onClose={() => setMenu(false)} items={[
      ['일기 수정', () => { setMenu(false); onEdit(); }],
      ['일기 삭제', () => { setMenu(false); onDelete(); }, true],
    ]} />
  </View>;
}

function MenuSheet({ visible, onClose, items }) {
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <Pressable style={s.sheetLayer} onPress={onClose} accessibilityLabel="메뉴 닫기">
      <Pressable style={s.sheet} accessibilityViewIsModal onPress={() => {}}>
        {items.map(([label, action, danger]) => <Pressable key={label} accessibilityRole="button" onPress={action}
          style={({ pressed }) => [s.sheetRow, pressed && s.pressed]}>
          <Text style={danger ? [s.dangerText, { fontSize: 16 }] : [s.label, { fontSize: 16 }]}>{label}</Text>
        </Pressable>)}
        <Action kind="soft" onPress={onClose}>닫기</Action>
      </Pressable>
    </Pressable>
  </Modal>;
}

// 일기 목록
export function Diaries({ diaries, today, onOpen, onWrite }) {
  const todayDiary = diaries.find(item => item.date === today);
  const list = diaries.filter(item => !item.deleted);
  return <View style={s.page}>
    <Header title="일기" />
    <View style={s.content}>
      <View style={s.card}>
        <Text style={s.sectionDate}>{dateLabel(today)}</Text>
        <Text style={s.body}>{todayDiary ? (todayDiary.deleted ? '오늘 일기는 삭제했어요. 내일 다시 남길 수 있어요.' : '오늘 일기를 남겼어요. 오늘 안에는 수정할 수 있어요.') : '오늘의 일기를 남기면 밤 10시에 일기를 읽은 상대방이 시그널을 보내요. 일기를 쓰지 않은 날은 그날 대화로 써요.'}</Text>
        {!todayDiary ? <Action icon="pen" onPress={onWrite}>오늘의 일기 쓰기</Action>
          : !todayDiary.deleted ? <Action kind="soft" onPress={() => onOpen(today)}>오늘 남긴 일기 보기</Action> : null}
      </View>
      {list.length === 0 ? <View style={s.empty}><Text style={{ fontSize: 36 }}>📔</Text><Text style={s.title}>아직 남긴 일기가 없어요</Text></View>
        : <Text style={s.sectionDate}>지난 일기</Text>}
      {list.map(diary => <Pressable key={diary.date} accessibilityRole="button" onPress={() => onOpen(diary.date)}
        style={({ pressed }) => [s.record, pressed && s.pressed]}>
        <View style={s.recordDate}><Text style={s.moodEmoji}>{diary.emoji}</Text></View>
        <View style={[s.flex, { gap: 2 }]}><Text style={s.label}>{dateLabel(diary.date)}</Text><Text style={s.note} numberOfLines={1}>{diary.text}</Text></View>
        <Icon name="next" size={16} />
      </Pressable>)}
    </View>
  </View>;
}

// 8. 시그널 보관함 (밤 테마)
export function SignalArchive({ signals, characters, onOpen, onChat, canTest, onTest, testing, error, waitingFor }) {
  return <View style={s.nightPage}>
    <StarrySky />
    <Header title="시그널 보관함" night />
    <View style={s.content}>
      {waitingFor ? <View style={s.nightCardBox}>
        <Text style={s.nightTime}>오늘 밤 10:00 도착 예정</Text>
        <Text style={[s.countdown, { color: C.nightText }]}>{waitingFor} 남았어요</Text>
        <Text style={[s.note, s.nightMuted]}>오늘 남긴 일기를 먼저 읽고, 일기가 없으면 오늘 나눈 대화를 바탕으로 상대방 한 명이 하루 마무리 편지를 보내요.</Text>
      </View> : null}
      {canTest ? <Action icon="moon" kind="nightSoft" disabled={testing} onPress={onTest}>{testing ? '시그널을 쓰는 중이에요…' : '밤 10시 도착 테스트 (시연용)'}</Action> : null}
      {error ? <Notice danger>{error}</Notice> : null}
      {!signals.length ? <View style={s.empty}>
        <Svg width={120} height={84} viewBox="0 0 150 104"><Envelope /></Svg>
        <Text style={[s.title, s.nightText]}>아직 도착한 시그널이 없어요.</Text>
        <Text style={[s.note, s.nightMuted]}>일기를 쓰거나 대화를 나눈 날 밤 10시에 시그널이 도착해요.</Text>
        <Action kind="nightSoft" onPress={onChat}>채팅방으로 돌아가기</Action></View> : null}
      {signals.map(signal => {
        const sender = signal.guessId ? characters.find(person => person.id === signal.senderId) : null;
        return <Pressable key={signal.id} accessibilityRole="button" accessibilityLabel={`${dateLabel(signal.date)} 시그널${signal.read ? '' : ', 새 시그널'}`}
          onPress={() => onOpen(signal.id)} style={({ pressed }) => [s.signalRow, !signal.read && s.signalNew, pressed && s.pressed]}>
          {sender ? <Avatar person={sender} size={44} ring={tone(sender.id).main} /> : <Text style={{ fontSize: 30 }}>{signal.read ? '✉️' : '💌'}</Text>}
          <View style={[s.flex, { gap: 3 }]}>
            <Text style={[s.label, s.nightText]} numberOfLines={1}>{signal.guessId ? `${josa(sender?.name ?? '상대방', '이', '가')} 보낸 시그널` : '누군가 보낸 시그널'}</Text>
            <Text style={[s.note, s.nightMuted]} numberOfLines={1}>{signal.read ? signalPreview(signal.message) : '아직 열지 않은 편지예요'}</Text>
            <Text style={[s.timestamp, s.nightMuted]}>{dateLabel(signal.date)} · {time.format(new Date(signal.arrivedAt))} 도착</Text>
          </View>
          {!signal.read ? <Text style={s.newTag}>NEW</Text> : <Text style={[s.note, s.nightMuted]}>{signal.guessId ? '추측 완료' : '읽음'}</Text>}
        </Pressable>;
      })}
    </View>
  </View>;
}

function Envelope({ open = false }) {
  return <>
    <Rect x="6" y="14" width="138" height="84" rx="10" fill="#F6EEDF" />
    <Path d={open ? 'M6 24 75 -18l69 42' : 'M6 24l69 46 69-46'} fill={open ? '#EADFCB' : 'none'} stroke="#D6C6A8" strokeWidth={2} strokeLinejoin="round" />
    <Path d="M6 96 60 58m84 38L90 58" stroke="#E2D4BA" strokeWidth={2} />
    {!open ? <Circle cx="75" cy="66" r="11" fill={C.heart} /> : null}
    {!open ? <Path d="M75 71s-6-3.4-6-7a3 3 0 0 1 6-.9 3 3 0 0 1 6 .9c0 3.6-6 7-6 7Z" fill="#FFFFFF" /> : null}
  </>;
}

// 9. 시그널 상세: 처음엔 봉투가 닫혀 있고, 열면 편지가 펼쳐진다.
export function SignalDetail({ signal, characters, onOpenEnvelope, onGuess, onResult, onBack }) {
  const sender = characters.find(person => person.id === signal.senderId);
  const picked = characters.find(person => person.id === signal.guessId);
  const reveal = useRef(new Animated.Value(signal.read ? 1 : 0)).current;
  const [opened, setOpened] = useState(signal.read);
  function open() {
    setOpened(true);
    onOpenEnvelope();
    Animated.timing(reveal, { toValue: 1, duration: 650, useNativeDriver: native }).start();
  }
  return <View style={s.nightPage}>
    <StarrySky dense={false} />
    <Header title="시그널" onBack={onBack} night />
    <View style={s.content}>
      <View style={{ alignItems: 'center', gap: 4 }}>
        <Text style={s.nightTime}>{dateLabel(signal.date)} · {time.format(new Date(signal.arrivedAt))}</Text>
        <Text style={[s.title, s.nightText]}>{signal.guessId ? `보낸 사람 · ${sender?.name ?? '상대방'}` : '보낸 사람은 아직 비밀이에요'}</Text>
      </View>
      {!opened ? <Pressable accessibilityRole="button" accessibilityLabel="봉투 열기" onPress={open} style={({ pressed }) => [s.envelope, pressed && s.pressed]}>
        <Svg style={s.envelopeArt} viewBox="0 0 150 104"><Envelope /></Svg>
        <Text style={[s.label, s.nightText]}>봉투를 눌러 열어 보세요</Text>
      </Pressable> : <Animated.View style={[s.letter, {
        opacity: reveal, transform: [{ translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }],
      }]}>
        <Text style={s.letterText}>{signal.message}</Text>
        <Text style={s.letterSign}>— {signal.guessId ? sender?.name : '???'} 보냄</Text>
      </Animated.View>}
      {opened ? (signal.guessId ? <>
        <Text style={[s.note, s.nightMuted, { textAlign: 'center' }]}>내가 고른 상대방 · {picked?.name ?? '-'}</Text>
        <Action onPress={onResult}>추측 결과 다시 보기</Action>
      </> : <Action icon="arrow" onPress={onGuess}>누가 보냈을까요?</Action>) : null}
      <Action kind="nightSoft" onPress={onBack}>보관함으로</Action>
    </View>
  </View>;
}

// 10. 발신자 선택: 편지의 말투로 누구인지 알아본다.
export function SenderPick({ signal, characters, onSubmit, onBack, busy, error }) {
  const [choice, setChoice] = useState(null);
  return <View style={s.nightPage}>
    <StarrySky dense={false} />
    <Header title="발신자 추측" onBack={onBack} night />
    <View style={s.content}>
      <Text accessibilityRole="header" style={s.bigQuestion}>누가 보냈을까요?</Text>
      <Text style={[s.note, s.nightMuted, { textAlign: 'center' }]}>편지의 말투를 떠올려 보세요.</Text>
      <View style={[s.letter, { padding: 16 }]}><Text style={[s.letterText, { fontSize: 15 }]} numberOfLines={4}>{signal.message}</Text></View>
      <View style={s.formRow}>{characters.map(person => {
        const selected = choice === person.id;
        const color = tone(person.id);
        return <Pressable key={person.id} accessibilityRole="radio" accessibilityLabel={person.name}
          accessibilityState={{ checked: selected, disabled: busy }} disabled={busy} onPress={() => setChoice(person.id)}
          style={[s.guessChoice, selected && { borderColor: color.main, backgroundColor: '#352E63' }]}>
          <Avatar person={person} size={64} ring={selected ? color.main : undefined} />
          <Text style={[s.title, s.nightText]}>{person.name}</Text>
          <Text style={[s.note, s.nightMuted]}>{voice(person)}</Text>
          <Text style={selected ? [s.segmentLabel, { color: C.star }] : [s.note, s.nightMuted]}>{selected ? '✓ 선택됨' : '선택하기'}</Text>
        </Pressable>;
      })}</View>
      <Text style={[s.note, s.nightMuted]}>한 시그널에는 한 번만 추측할 수 있어요. 선택하기를 누르기 전에는 바꿀 수 있어요.</Text>
      {error ? <Notice danger>{error}</Notice> : null}
      <Action disabled={!choice || busy} onPress={() => onSubmit(choice)}>{busy ? '확인하는 중…' : '선택하기'}</Action>
      <Action kind="nightSoft" disabled={busy} onPress={onBack}>시그널 다시 보기</Action>
    </View>
  </View>;
}

// 11. 추측 결과
export function GuessResult({ signal, characters, affinity = {}, onArchive, onChat }) {
  const sender = characters.find(person => person.id === signal.senderId);
  const picked = characters.find(person => person.id === signal.guessId);
  const correct = signal.guessId === signal.senderId;
  // 방금 맞힌 결과일 때만 하트를 터뜨린다(나중에 다시 열면 조용히).
  const fresh = correct && signal.guessedAt && Date.now() - new Date(signal.guessedAt).getTime() < 15_000;
  const pop = useRef(new Animated.Value(0.6)).current;
  useEffect(() => { Animated.spring(pop, { toValue: 1, friction: 5, useNativeDriver: native }).start(); }, []);
  if (!sender) return null;
  const color = tone(sender.id);
  return <View style={s.nightPage}>
    <StarrySky dense={false} />
    <Header title="추측 결과" night />
    <View style={s.content}>
      <Animated.View style={[s.result, { transform: [{ scale: pop }] }]}>
        <Text style={s.resultEmoji}>{correct ? '💖' : '💌'}</Text>
        <Text accessibilityRole="header" style={s.bigQuestion}>{correct ? '맞혔어요!' : '이번엔 다른 상대방이었어요.'}</Text>
        <View>
          <Avatar person={sender} size={84} ring={color.main} />
          {fresh ? <HeartBurst color={color.main} /> : null}
        </View>
        <Text style={[s.title, s.nightText]}>{sender.name}</Text>
        {correct ? <Text style={[s.plusHeart, { backgroundColor: C.heart }]}>♥ 호감도 +3</Text> : null}
        <Text style={[s.body, s.nightMuted, { textAlign: 'center' }]}>{correct
          ? `역시 ${sender.name}의 말투를 알아봤네요. ${sender.name}의 호감도가 올랐어요.`
          : `이 편지는 ${sender.name}의 '${voice(sender)}' 말투였어요.${picked ? ` ${picked.name}의 말투는 '${voice(picked)}'예요.` : ''} 다음 시그널도 기대해 주세요.`}</Text>
        {correct ? <View style={{ alignSelf: 'stretch' }}><HeartMeter value={affinity[sender.id] ?? 0} id={sender.id} night /></View> : null}
      </Animated.View>
      {!correct && picked ? <View style={[s.nightCardBox, s.row]}>
        <Avatar person={picked} size={40} /><Text style={[s.note, s.nightMuted, s.flex]}>내 선택 · {picked.name}</Text>
      </View> : null}
      <Action onPress={onArchive}>보관함으로</Action>
      <Action kind="nightSoft" onPress={onChat}>채팅방으로</Action>
    </View>
  </View>;
}

// 설정
function SettingsRow({ children, onPress, danger = false, detail }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [s.settingsRow, pressed && s.pressed]}>
    <View style={[s.flex, { gap: 2, paddingVertical: 8 }]}><Text style={danger ? s.dangerText : s.label}>{children}</Text>{detail ? <Text style={s.note}>{detail}</Text> : null}</View>
    <Icon name="next" color={danger ? C.danger : C.accent} size={16} />
  </Pressable>;
}

/** 낮 화면 배경색 고르기: 색 버튼 5개 + 저장. */
function BackgroundPicker({ value, onSave }) {
  const [picked, setPicked] = useState(value);
  const [saved, setSaved] = useState(false);
  useEffect(() => { setPicked(value); }, [value]);
  const changed = picked !== value;
  return <View style={s.cardSection}>
    <Text style={s.label}>배경색</Text>
    <View style={s.swatches} accessibilityRole="radiogroup">
      {BACKGROUNDS.map(item => <Pressable key={item.id} accessibilityRole="radio" accessibilityLabel={item.label}
        accessibilityState={{ checked: picked === item.id }} onPress={() => { setPicked(item.id); setSaved(false); }}
        style={[s.swatch, picked === item.id && s.swatchOn]}>
        <View style={[s.swatchDot, { backgroundColor: item.swatch }]} />
      </Pressable>)}
    </View>
    <Text style={s.note}>{backgroundOf(picked).label} · 채팅방, 일기, 설정 화면에 밤낮 상관없이 적용돼요. 시그널 화면은 밤하늘 그대로예요.</Text>
    <Action disabled={!changed} onPress={() => { onSave(picked); setSaved(true); }}>{saved && !changed ? '저장했어요' : '저장'}</Action>
  </View>;
}

export function Settings({ profile, characters, affinity, guest, background, onBackground, onEditProfile, onEditCharacter, onRegister, onRemove, onLogout, onPrivacy }) {
  return <View style={s.page}>
    <Header title="설정" />
    <View style={s.content}>
      <Text style={s.sectionDate}>내 프로필</Text>
      <SettingsRow onPress={onEditProfile} detail={guest ? '로그인 계정 없음 · 이 기기에서만 사용 중' : `아이디 ${profile.loginId}`}>{profile.nickname} 프로필 수정</SettingsRow>
      {guest ? <SettingsRow onPress={onRegister} detail="만들어 두면 로그아웃해도 다시 들어올 수 있어요. 기록은 그대로 이어져요.">로그인 계정 만들기</SettingsRow> : null}
      <Text style={s.sectionDate}>상대방 프로필</Text>
      {characters.map((person, index) => <View key={person.id} style={[s.characterRow, { flexDirection: 'column', alignItems: 'stretch' }]}>
        <View style={s.row}>
          <Avatar person={person} size={44} ring={tone(person.id).main} />
          <View style={s.flex}><Text style={s.label}>{person.name}</Text><Text style={s.note}>{relationLabel(person)} · {voice(person)}</Text></View>
          <Action small kind="soft" onPress={() => onEditCharacter(index)}>수정</Action>
          <Action small kind="soft" color={C.danger} onPress={() => onRemove({ type: 'character', index })}>삭제</Action>
        </View>
        <HeartMeter value={affinity[person.id] ?? 0} id={person.id} />
      </View>)}
      <Text style={s.sectionDate}>화면</Text>
      <BackgroundPicker value={background} onSave={onBackground} />
      <Text style={s.sectionDate}>개인정보와 기록</Text>
      <SettingsRow onPress={onPrivacy}>개인정보 안내</SettingsRow>
      <SettingsRow danger onPress={() => onRemove({ type: 'records' })} detail="일기, 채팅, 시그널을 지워요. 프로필은 남아요.">기록 삭제</SettingsRow>
      <SettingsRow danger onPress={() => onRemove({ type: 'account' })} detail="계정과 모든 기록을 이 기기에서 지워요.">계정·내 프로필 삭제</SettingsRow>
      {guest ? <Text style={s.note}>계정이 없을 때는 로그아웃할 수 없어요. 로그아웃하면 이 기록에 다시 들어올 방법이 없기 때문이에요.</Text>
        : <Action kind="soft" onPress={onLogout}>로그아웃</Action>}
    </View>
  </View>;
}

export function Privacy({ onBack, provider }) {
  const rows = [
    ['수집하는 정보', '로그인 아이디와 비밀번호(해시로 저장), 내 프로필(이름, 좋아하는 것, 싫어하는 것, MBTI, 성별), 상대방 프로필과 사진, 일기와 감정 이모지, 채팅과 시그널.'],
    ['수집 목적', '상대방이 나에게 맞춘 말투로 대화하고, 일기에 응원을 남기고, 밤 10시 시그널을 쓰기 위해서예요. 호감도는 상대방과의 관계를 보여줄 뿐 내려가지 않고, 사용자를 점수화하거나 다른 사람과 비교하지 않아요.'],
    ['저장 위치와 보관 기간', '모든 정보는 이 기기(또는 브라우저)에만 저장돼요. 직접 삭제하거나 앱 데이터를 지울 때까지 보관해요.'],
    ['AI로 보내는 정보', provider === 'baze'
      ? '베이즈 테스트 모드에서는 동의 후 내 프로필의 텍스트, 상대방의 텍스트 설정, 일기 또는 같은 방의 최근 대화를 베이즈로 보내요. 사진과 비밀번호는 보내지 않아요.'
      : '답장·일기 응원·시그널을 만들 때 내 프로필의 텍스트, 상대방의 텍스트 설정, 일기 또는 같은 방의 최근 대화를 개발 PC의 로컬 AI로 보내요. 사진과 비밀번호는 보내지 않아요.'],
    ['알림', '앱에서 일기나 대화를 남긴 날 밤 10시에 시그널 도착 알림을 이 기기에서 한 번 보내요. 알림 내용에는 일기 내용이 들어가지 않아요. 기기 설정에서 언제든 끌 수 있어요.'],
    ['수정과 삭제', '설정 → 내 프로필·상대방 수정, 일기 화면의 ⋯ 메뉴에서 오늘 일기 수정·삭제, 설정 → 기록 삭제 / 계정·내 프로필 삭제.'],
    ['서비스의 범위', '하루시그널은 기록과 응원을 위한 서비스이며 진단, 치료, 상담을 제공하지 않아요. 위험한 상황이면 112·119, 마음이 힘들 땐 109에 연락해 주세요.'],
  ];
  return <View style={s.page}>
    <Header title="개인정보 안내" onBack={onBack} />
    <View style={s.content}>
      {rows.map(([title, body]) => <View key={title} style={s.recordDetail}><Text style={s.label}>{title}</Text><Text style={s.body}>{body}</Text></View>)}
      <Text style={s.note}>시연과 테스트에는 실제 이름·사진 대신 합성 이름과 기본 아바타를 사용해 주세요.</Text>
    </View>
  </View>;
}

export function Loading({ children }) {
  return <View style={s.center}><ActivityIndicator color={C.accent} /><Text style={s.note}>{children}</Text></View>;
}

export function Confirm({ dialog, onCancel, onConfirm, busy, error }) {
  return <Modal visible={Boolean(dialog)} transparent animationType="fade" onRequestClose={onCancel}>
    <View style={s.modalLayer}><View style={s.dialog} accessibilityViewIsModal>
      <Text accessibilityRole="header" style={s.title}>{dialog?.title}</Text>
      <Text style={s.body}>{dialog?.body}</Text>
      {error ? <Notice danger>{error}</Notice> : null}
      <View style={s.formRow}><View style={s.flex}><Action kind="soft" onPress={onCancel} disabled={busy}>취소</Action></View>
        <View style={s.flex}><Action kind="danger" onPress={onConfirm} disabled={busy}>{busy ? '삭제 중…' : dialog?.confirm ?? '삭제'}</Action></View></View>
    </View></View>
  </Modal>;
}

export function BazeConsent({ visible, onCancel, onAccept }) {
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
    <View style={s.modalLayer}><View style={s.dialog} accessibilityViewIsModal>
      <Text accessibilityRole="header" style={s.title}>베이즈 AI 테스트</Text>
      <Text style={s.body}>GPT-6 Luna가 답장할 수 있도록 현재 메시지와 같은 방의 최근 대화, 일기와 감정 이모지, 상대방의 텍스트 설정, 내 프로필의 텍스트(이름·좋아하는 것·싫어하는 것·MBTI·성별)를 베이즈로 보내요. 사진과 비밀번호는 기기에 보관해요.</Text>
      <Text style={s.body}>학교 계정의 API 크레딧을 사용하는 테스트예요. 가상의 이름과 이야기만 입력해 주세요.</Text>
      <Action onPress={onAccept}>동의하고 테스트하기</Action>
      <Action kind="soft" onPress={onCancel}>닫기</Action>
    </View></View>
  </Modal>;
}
