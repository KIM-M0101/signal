import { Platform } from 'react-native';
import { SIGNAL_HOUR } from './model.js';

// 웹 미리보기에서는 알림을 쓰지 않는다. 기기에서는 일기를 쓴 날 밤 10시에 로컬 알림 한 번.
let Notifications = null;
if (Platform.OS !== 'web') {
  try {
    Notifications = require('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
    });
  } catch {
    Notifications = null;
  }
}

const idFor = date => `harusignal-${date}`;

export async function scheduleSignalNotice(date, now = new Date()) {
  if (!Notifications) return false;
  const [y, m, d] = date.split('-').map(Number);
  const when = new Date(y, m - 1, d, SIGNAL_HOUR, 0, 0);
  if (when <= now) return false;
  try {
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') ({ status } = await Notifications.requestPermissionsAsync());
    if (status !== 'granted') return false;
    await Notifications.cancelScheduledNotificationAsync(idFor(date)).catch(() => {});
    await Notifications.scheduleNotificationAsync({
      identifier: idFor(date),
      content: { title: '하루시그널', body: '오늘의 시그널이 도착했어요. 누가 보냈는지 열어볼까요?' },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when },
    });
    return true;
  } catch {
    return false;
  }
}

export async function cancelSignalNotice(date) {
  if (!Notifications) return;
  try { await Notifications.cancelScheduledNotificationAsync(idFor(date)); } catch { /* 이미 없음 */ }
}

export async function cancelAllSignalNotices() {
  if (!Notifications) return;
  try { await Notifications.cancelAllScheduledNotificationsAsync(); } catch { /* 무시 */ }
}
