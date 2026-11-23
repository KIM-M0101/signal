import { Platform, StyleSheet } from 'react-native';

export const fonts = { regular: 'Pretendard-Regular', semibold: 'Pretendard-SemiBold', bold: 'Pretendard-Bold' };

export const colors = {
  ink: '#2A2238', muted: '#6E6680', accent: '#6C4BC1', lilac: '#EFE8FB', wash: '#F7F3FC',
  border: '#ECE6F3', paper: '#FFFFFF', tint: '#FFFCF8', cream: '#FBF6EF', danger: '#B03A5B', heart: '#D9457A',
  night: '#1D1938', nightCard: '#2A2550', nightLine: '#3D3670', nightText: '#F4F0FF', nightMuted: '#BDB4DA', star: '#FFD98A',
};
const C = colors;
const border = { borderWidth: 1, borderColor: C.border };
const row = { flexDirection: 'row', alignItems: 'center' };
const shadow = Platform.select({
  web: { boxShadow: '0 6px 18px rgba(60, 40, 110, 0.07)' },
  default: { shadowColor: '#3C286E', shadowOpacity: 0.07, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
});

const base = {
  root: { flex: 1, alignItems: 'center', backgroundColor: '#EFE9F5' },
  frame: { flex: 1, width: '100%', maxWidth: 470, backgroundColor: C.tint },
  main: { flex: 1, minWidth: 0, minHeight: 0, backgroundColor: C.tint },
  scrollBody: { flexGrow: 1 },
  flex: { flex: 1, minWidth: 0 },
  page: { flexGrow: 1, backgroundColor: C.tint },
  nightPage: { flexGrow: 1, backgroundColor: C.night },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  recovery: { gap: 10, padding: 20, paddingTop: 32 },
  content: { padding: 18, gap: 14 },

  body: { color: C.ink, fontSize: 16, lineHeight: 25 },
  note: { color: C.muted, fontSize: 13.5, lineHeight: 20 },
  label: { color: C.ink, fontSize: 15, lineHeight: 21, fontWeight: '600' },
  title: { color: C.ink, fontSize: 18, lineHeight: 26, fontWeight: '700' },
  display: { color: C.ink, fontSize: 26, lineHeight: 34, fontWeight: '700', letterSpacing: -0.6 },
  whiteText: { color: C.paper },
  nightText: { color: C.nightText },
  nightMuted: { color: C.nightMuted },
  dangerText: { color: C.danger, fontSize: 13.5, lineHeight: 20, fontWeight: '600' },
  row: { ...row, gap: 10 },
  rowBetween: { ...row, justifyContent: 'space-between', gap: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  formRow: { flexDirection: 'row', gap: 10 },
  pressed: { opacity: 0.78 },
  disabled: { opacity: 0.45 },

  action: { ...row, justifyContent: 'center', minHeight: 50, paddingHorizontal: 16, paddingVertical: 10, gap: 8, borderRadius: 16 },
  primary: { backgroundColor: C.accent },
  soft: { ...border, backgroundColor: C.paper },
  ghost: { backgroundColor: 'transparent', minHeight: 44 },
  danger: { backgroundColor: C.danger },
  nightSoft: { borderWidth: 1, borderColor: C.nightLine, backgroundColor: C.nightCard },
  actionText: { color: C.accent, fontSize: 15, lineHeight: 21, fontWeight: '700', textAlign: 'center', flexShrink: 1 },
  smallAction: { minHeight: 40, paddingHorizontal: 12, borderRadius: 12 },
  smallActionText: { fontSize: 13.5 },
  notice: { padding: 12, borderRadius: 14, backgroundColor: C.wash },
  noticeDanger: { backgroundColor: '#FFF1F4' },
  emblem: { alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: 14, backgroundColor: C.lilac },
  avatar: { overflow: 'hidden', flexShrink: 0, backgroundColor: C.lilac },

  brand: { ...row, alignSelf: 'flex-start', gap: 7 },
  brandMark: { width: 24, height: 24, textAlign: 'center', lineHeight: 24, fontSize: 15, fontWeight: '700',
    color: C.accent, backgroundColor: C.lilac, borderRadius: 8, borderBottomLeftRadius: 3, overflow: 'hidden' },
  brandWord: { color: C.accent, fontSize: 11.5, fontWeight: '700', letterSpacing: 1.6 },
  header: { ...row, minHeight: 60, paddingLeft: 8, paddingRight: 12, gap: 4, backgroundColor: C.tint },
  headerNight: { backgroundColor: C.night },
  headerTitle: { flex: 1, color: C.ink, fontSize: 19, fontWeight: '700', letterSpacing: -0.4 },
  tag: { color: C.accent, fontSize: 12, fontWeight: '700', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 99, backgroundColor: C.lilac, overflow: 'hidden' },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  dot: { position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: C.heart },

  // 탭
  tabs: { flexDirection: 'row', justifyContent: 'space-around', paddingTop: 6, paddingBottom: 6, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.paper },
  tab: { alignItems: 'center', justifyContent: 'center', flex: 1, minHeight: 50, gap: 3 },
  tabLabel: { color: C.muted, fontSize: 12, lineHeight: 16 },
  tabActive: { color: C.accent, fontWeight: '700' },
  tabDot: { position: 'absolute', top: -2, right: -4, width: 8, height: 8, borderRadius: 4, backgroundColor: C.heart },

  // 입력
  segment: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 14, backgroundColor: '#F1EBF8' },
  segmentButton: { ...row, flex: 1, minWidth: 0, minHeight: 44, justifyContent: 'center', gap: 6, borderRadius: 10, padding: 4 },
  segmentActive: { backgroundColor: C.paper, ...shadow },
  segmentText: { color: C.muted, fontSize: 14, lineHeight: 20 },
  segmentLabel: { color: C.accent, fontSize: 14, fontWeight: '700' },
  field: { minWidth: 0, gap: 6 },
  half: { flex: 1, minWidth: 0 },
  labelRow: { ...row, gap: 6 },
  required: { color: C.accent, fontSize: 12, fontWeight: '600' },
  optional: { color: C.muted, fontSize: 12 },
  input: { minHeight: 50, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, ...border, color: C.ink, backgroundColor: C.paper, fontSize: 16,
    ...Platform.select({ web: { outlineColor: C.accent } }) },
  inputError: { borderColor: C.danger },
  textarea: { minHeight: 84, textAlignVertical: 'top' },
  chip: { minHeight: 42, justifyContent: 'center', paddingHorizontal: 15, borderRadius: 99, ...border, backgroundColor: C.paper },
  chipActive: { borderColor: C.accent, backgroundColor: C.lilac },
  chipText: { color: C.muted, fontSize: 14 },
  chipLabel: { color: C.accent, fontWeight: '700' },
  link: { color: C.accent, fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' },
  linkButton: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  card: { gap: 10, padding: 16, borderRadius: 20, backgroundColor: C.paper, ...shadow },
  cardSection: { gap: 12, padding: 16, borderRadius: 20, backgroundColor: C.paper, ...shadow },
  steps: { flexDirection: 'row', gap: 5 },
  step: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#E6DDF3' },
  stepOn: { backgroundColor: C.accent },
  more: { ...row, justifyContent: 'center', minHeight: 44, gap: 6 },

  // 첫 화면
  intro: { flexGrow: 1, justifyContent: 'center', gap: 14, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 32, backgroundColor: C.tint },
  introArt: { borderRadius: 28, backgroundColor: '#F2EAFC', marginBottom: 6 },
  introTitle: { color: C.ink, fontSize: 40, lineHeight: 50, fontWeight: '700', letterSpacing: -1.6 },

  // 캐릭터 설정
  photoRow: { ...row, gap: 14 },
  avatarOption: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 26, borderWidth: 2, borderColor: 'transparent' },
  avatarSelected: { borderColor: C.accent },
  colorDot: { width: 9, height: 9, borderRadius: 5 },
  preview: { gap: 8, padding: 14, borderRadius: 20, borderWidth: 1 },
  previewTitle: { fontSize: 12.5, fontWeight: '700', letterSpacing: 0.3 },

  // 홈
  hero: { gap: 6, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 22, backgroundColor: C.cream },
  heroNight: { backgroundColor: C.night },
  heroTitle: { color: C.ink, fontSize: 28, lineHeight: 36, fontWeight: '700', letterSpacing: -1 },
  today: { gap: 12, marginHorizontal: 16, marginTop: -6, padding: 16, borderRadius: 22, backgroundColor: C.paper, ...shadow },
  todayNight: { backgroundColor: C.nightCard },
  todayEmoji: { fontSize: 30, lineHeight: 36 },
  countdown: { color: C.accent, fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: -0.5 },
  sectionTitle: { color: C.ink, fontSize: 16, fontWeight: '700', paddingHorizontal: 20, paddingTop: 22, paddingBottom: 8 },
  rooms: { paddingHorizontal: 16, gap: 12, paddingBottom: 20 },
  characterCard: { gap: 12, padding: 16, borderRadius: 22, borderWidth: 1, backgroundColor: C.paper, ...shadow },
  peerName: { color: C.ink, fontWeight: '700', fontSize: 18, lineHeight: 24 },
  status: { ...row, gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 14 },
  timestamp: { color: C.muted, fontSize: 12, lineHeight: 16, flexShrink: 0 },
  badge: { minWidth: 22, height: 22, paddingHorizontal: 6, lineHeight: 22, textAlign: 'center', borderRadius: 99, overflow: 'hidden',
    fontSize: 12, color: C.paper, fontWeight: '700' },

  // 호감도
  meter: { gap: 6 },
  meterTrack: { height: 8, borderRadius: 4, backgroundColor: '#F0EAF6', overflow: 'hidden' },
  meterFill: { height: 8, borderRadius: 4 },
  stageName: { fontSize: 13, fontWeight: '700' },
  heart: { fontSize: 13, fontWeight: '700', lineHeight: 18 },

  // 채팅
  chat: { flex: 1, minHeight: 0, backgroundColor: C.tint },
  chatHeader: { ...row, gap: 4, minHeight: 64, paddingLeft: 4, paddingRight: 6, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.paper },
  chatProfile: { ...row, flex: 1, minHeight: 44, minWidth: 0, gap: 10, borderRadius: 12 },
  connection: { paddingHorizontal: 14, paddingVertical: 7, backgroundColor: C.lilac },
  bazeStatus: { ...row, gap: 8 },
  bazeInfoButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  messages: { paddingHorizontal: 14, paddingVertical: 16, gap: 14 },
  dateChip: { alignSelf: 'center', color: C.muted, backgroundColor: '#F1EBF7', borderRadius: 99, overflow: 'hidden', paddingVertical: 4, paddingHorizontal: 11, fontSize: 12 },
  emptyMessage: { marginVertical: 20, paddingHorizontal: 8, textAlign: 'center', color: C.muted, fontSize: 14 },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 7 },
  mine: { justifyContent: 'flex-end' },
  messageColumn: { flexShrink: 1, minWidth: 0, maxWidth: '78%', gap: 4 },
  bubble: { alignSelf: 'flex-start', paddingVertical: 10, paddingHorizontal: 13, borderRadius: 18, borderBottomLeftRadius: 6, borderWidth: 1, gap: 4 },
  mineBubble: { alignSelf: 'flex-end', borderColor: C.accent, backgroundColor: C.accent, borderBottomLeftRadius: 18, borderBottomRightRadius: 6 },
  mineText: { color: C.paper },
  safetyBubble: { borderColor: '#DFD0F1', backgroundColor: '#F4ECFA' },
  diaryTag: { fontSize: 12.5, fontWeight: '700' },
  messageText: { color: C.ink, fontSize: 15.5, lineHeight: 23,
    ...Platform.select({ web: { wordBreak: 'keep-all', overflowWrap: 'anywhere' } }) },
  stageChip: { alignSelf: 'center', alignItems: 'center', gap: 4, maxWidth: '88%', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1 },
  wait: { ...row, gap: 8, alignSelf: 'flex-start', borderRadius: 14, backgroundColor: C.wash, padding: 10 },
  retry: { ...row, gap: 7, padding: 10, borderRadius: 14, backgroundColor: '#FFF0F4' },
  retryButton: { justifyContent: 'center', minHeight: 44, paddingHorizontal: 6 },
  composer: { ...row, gap: 6, marginHorizontal: 12, marginVertical: 8, padding: 4, paddingLeft: 14, backgroundColor: C.paper, ...border, borderRadius: 28 },
  composerFocused: { borderColor: '#A585D5' },
  chatInput: { flex: 1, color: C.ink, minHeight: 40, maxHeight: 126, fontSize: 16, lineHeight: 22, padding: 0, paddingVertical: 9,
    ...Platform.select({ web: { outlineStyle: 'none' } }) },
  send: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: C.accent },

  // 일기
  moods: { flexDirection: 'row', gap: 6 },
  mood: { flex: 1, minWidth: 0, alignItems: 'center', gap: 3, paddingVertical: 11, paddingHorizontal: 2, borderRadius: 16, ...border, backgroundColor: C.paper },
  moodActive: { borderColor: C.accent, backgroundColor: C.lilac },
  moodError: { borderColor: C.danger },
  moodEmoji: { fontSize: 28, lineHeight: 34 },
  moodBig: { fontSize: 38, lineHeight: 46 },
  moodLabel: { color: C.muted, fontSize: 12, lineHeight: 16, textAlign: 'center',
    ...Platform.select({ web: { wordBreak: 'keep-all' } }) },
  question: { color: C.ink, fontSize: 17, lineHeight: 25, fontWeight: '600' },
  diaryPaper: { gap: 8, padding: 16, borderRadius: 20, backgroundColor: C.cream },
  commentCard: { gap: 8, padding: 16, borderRadius: 20, backgroundColor: C.lilac },
  reaction: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  typing: { ...row, gap: 4, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 18, borderBottomLeftRadius: 6, backgroundColor: C.paper, ...border },
  typingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.muted },
  empty: { paddingVertical: 32, alignItems: 'center', gap: 8 },
  sectionDate: { color: C.muted, fontSize: 13, fontWeight: '600', paddingTop: 2 },
  record: { ...row, minHeight: 70, gap: 12, padding: 12, borderRadius: 18, backgroundColor: C.paper, ...shadow },
  recordDate: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: C.cream },
  recordDetail: { padding: 16, gap: 8, borderRadius: 20, backgroundColor: C.paper, ...shadow },

  // 시그널(밤)
  nightCardBox: { gap: 10, padding: 16, borderRadius: 20, backgroundColor: C.nightCard, borderWidth: 1, borderColor: C.nightLine },
  signalRow: { ...row, minHeight: 76, gap: 12, padding: 14, borderRadius: 20, backgroundColor: C.nightCard, borderWidth: 1, borderColor: C.nightLine },
  signalNew: { borderColor: C.star },
  newTag: { color: C.night, fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, backgroundColor: C.star, overflow: 'hidden' },
  envelope: { alignItems: 'center', justifyContent: 'center', gap: 14, paddingVertical: 34, borderRadius: 24, backgroundColor: C.nightCard, borderWidth: 1, borderColor: C.nightLine },
  envelopeArt: { width: 150, height: 104 },
  letter: { gap: 14, padding: 22, borderRadius: 22, backgroundColor: '#FFFBF3' },
  letterText: { color: '#3A3047', fontSize: 16.5, lineHeight: 28 },
  letterSign: { color: '#8A7F98', fontSize: 13, textAlign: 'right' },
  nightTime: { color: C.star, fontSize: 12, fontWeight: '700', letterSpacing: 1.5 },
  bigQuestion: { color: C.nightText, fontSize: 26, lineHeight: 34, fontWeight: '700', letterSpacing: -0.8, textAlign: 'center' },
  guessChoice: { flex: 1, alignItems: 'center', paddingVertical: 18, paddingHorizontal: 8, gap: 6, borderRadius: 20, borderWidth: 2, borderColor: C.nightLine, backgroundColor: C.nightCard },
  result: { alignItems: 'center', gap: 8, padding: 22, borderRadius: 24, backgroundColor: C.nightCard },
  resultEmoji: { fontSize: 44, lineHeight: 52 },

  // 설정·모달
  settingsRow: { ...row, justifyContent: 'space-between', minHeight: 56, paddingHorizontal: 14, gap: 8, borderRadius: 16, backgroundColor: C.paper, ...shadow },
  characterRow: { ...row, gap: 10, padding: 12, borderRadius: 18, backgroundColor: C.paper, ...shadow },
  modalLayer: { flex: 1, padding: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1D193866' },
  sheetLayer: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', backgroundColor: '#1D193855' },
  sheet: { width: '100%', maxWidth: 470, gap: 6, padding: 16, paddingBottom: 28, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: C.paper },
  sheetRow: { minHeight: 52, justifyContent: 'center', paddingHorizontal: 8, borderRadius: 12 },
  dialog: { width: '100%', maxWidth: 380, padding: 20, gap: 14, borderRadius: 22, backgroundColor: C.paper },
};

// 굵기별 Pretendard 파일을 지정한다(Android는 fontWeight만으로 굵은 글꼴을 고르지 못한다).
function withFonts(styles) {
  return Object.fromEntries(Object.entries(styles).map(([key, style]) => {
    if (!('fontSize' in style || 'fontWeight' in style)) return [key, style];
    const { fontWeight, ...rest } = style;
    const family = fontWeight === '700' ? fonts.bold : fontWeight === '600' ? fonts.semibold : fonts.regular;
    return [key, { ...rest, fontFamily: family }];
  }));
}

export const styles = StyleSheet.create(withFonts(base));
