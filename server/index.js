import { createSignalServer } from './chat.js';

const host = process.env.SIGNAL_HOST ?? '127.0.0.1';
const port = Number(process.env.SIGNAL_PORT ?? 8081);
const modelPort = Number(process.env.SIGNAL_MODEL_PORT ?? 8083);
const server = createSignalServer({ host, modelPort });
server.listen(port, host, () => console.log(`Signal House: http://${host}:${port}`));
