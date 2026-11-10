const endpoint = 'https://api.baze.co/v1/gateway/chat/completions/';
export const BAZE_MODEL = 'gpt-6-luna';

export function requestBazeChat({ apiKey, messages, model = BAZE_MODEL, fetchModel = fetch }) {
  return fetchModel(endpoint, {
    method: 'POST',
    headers: { authorization: 'Bearer ' + apiKey, 'content-type': 'application/json' },
    redirect: 'error',
    signal: AbortSignal.timeout(30_000),
    body: JSON.stringify({
      model, max_tokens: 256, messages,
      ...(model === BAZE_MODEL ? { reasoning_effort: 'low' } : {}),
    }),
  });
}

export function readBazeUsage(usage) {
  const { prompt_tokens: input, completion_tokens: output } = usage ?? {};
  return Number.isSafeInteger(input) && input >= 0 && Number.isSafeInteger(output) && output >= 0
    ? { input, output }
    : null;
}
