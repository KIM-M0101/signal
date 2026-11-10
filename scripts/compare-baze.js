import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makePrompt } from '../server/chat.js';
import { BAZE_MODEL, readBazeUsage, requestBazeChat } from '../server/baze.js';

const candidates = [
  { id: BAZE_MODEL, inputRate: 0.10, outputRate: 0.50 },
  { id: 'solar-mini4', inputRate: 0.10, outputRate: 0.40 },
];
const yunseo = { name: '윤서', relation: '동갑', tone: '다정하게', address: '지우야', personality: '친한 친구처럼 짧고 따뜻하게 말해.' };
const haon = { name: '하온', relation: '연하', tone: '차분하게', address: '지우 님', personality: '담백하게 이야기하고 힘든 날은 먼저 들어줘요.' };
const achievement = '공부하기 싫었는데 수학 문제 두 개 풀었어.';
const message = (content, role = 'user') => ({ role, content });
const scenarios = [
  { label: '칭찬 · 윤서', expect: '이미 푼 수학 문제 두 개를 짚고 반말로 응원', character: yunseo, messages: [message(achievement)] },
  { label: '칭찬 · 하온', expect: '같은 행동을 짚되 차분한 해요체로 응원', character: haon, messages: [message(achievement)] },
  { label: '위로 · 윤서', expect: '지친 마음을 인정하고 반말로 듣기', character: yunseo, messages: [message('오늘 수업 끝나고 기운이 없었어. 해결책보다는 그냥 좀 들어줘.')] },
  { label: '위로 · 하온', expect: '해요체로 먼저 공감하고 사용자가 말할 여지를 주기', character: haon, messages: [message('준비한 발표에서 말을 더듬어서 계속 신경 쓰여요. 잠깐 위로받고 싶어요.')] },
  { label: '기억 · 윤서', expect: '발표 자료를 초록색 파일에 넣었다고 답하기', character: yunseo, messages: [
    message('발표 자료를 초록색 파일에 넣어 뒀어.'),
    message('발표 자료를 정리해 뒀구나. 준비하느라 수고했어.', 'assistant'),
    message('내가 발표 자료를 무슨 색 파일에 넣었다고 했지?'),
  ] },
  { label: '호칭 · 하온', expect: '호칭 지우 님을 자연스럽게 쓰고 사용자에게 해요체로 말하기', character: haon, messages: [message('나를 부르는 호칭을 써서 수고했다고 한마디 해줘요.')] },
];

export async function compareBaze({ apiKey, fetchModel = fetch }) {
  const key = apiKey?.trim();
  if (!key) throw new Error('새 API 키를 입력해 주세요.');
  const results = [];
  for (const scenario of scenarios) {
    for (const candidate of candidates) {
      const model = candidate.id;
      const start = performance.now();
      const messages = [{ role: 'system', content: makePrompt(scenario.character) }, ...scenario.messages];
      const response = await requestBazeChat({ apiKey: key, messages, model, fetchModel })
        .catch(() => { throw new Error(model + ' 연결 실패 또는 시간 초과'); });
      if (!response.ok) throw new Error(model + ' API 오류 HTTP ' + response.status + ' · Gateway에서 키, 모델 권한과 잔액을 확인해 주세요.');
      const payload = await response.json().catch(() => null);
      const reply = payload?.choices?.[0]?.message?.content;
      if (typeof reply !== 'string' || !reply.trim()) throw new Error(model + ' 응답에서 답장 텍스트를 읽지 못했어요.');
      const usage = readBazeUsage(payload.usage);
      const estimate = usage ? (usage.input * candidate.inputRate + usage.output * candidate.outputRate) / 1000 : null;
      results.push({
        case: scenario.label, expected: scenario.expect, model, reply: reply.trim(),
        input: usage?.input ?? null, output: usage?.output ?? null, latencyMs: Math.round(performance.now() - start),
        estimatedCredits: estimate === null ? null : Number(estimate.toFixed(4)),
      });
    }
  }
  return results;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const results = await compareBaze({ apiKey: process.env.BAZE_API_KEY });
    console.table(results.map(({ reply, expected, ...summary }) => summary));
    for (const { case: label, model, reply, expected } of results) {
      console.log('[' + label + ' · ' + model + '] ' + reply + '\n  확인할 점 · ' + expected);
    }
    console.log('크레딧 추정값은 공개 모델 단가 기준입니다. 실제 차감은 Gateway 사용량에서 확인하세요.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
