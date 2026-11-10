import { createSignalServer } from './chat.js';

const baze = process.argv.includes('--baze');
const host = baze ? '127.0.0.1' : process.env.SIGNAL_HOST ?? '127.0.0.1';
const port = baze ? 8084 : Number(process.env.SIGNAL_PORT ?? 8081);
const modelPort = Number(process.env.SIGNAL_MODEL_PORT ?? 8083);
const server = createSignalServer({
  host, modelPort, provider: baze ? 'baze' : 'local', apiKey: baze ? process.env.BAZE_API_KEY : undefined,
});
server.listen(port, host, () => console.log(`Signal House: http://${host}:${port}`));
