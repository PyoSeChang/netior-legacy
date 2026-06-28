import { createServer } from 'http';
import { closeDatabase, initDatabase } from '@netior/core';
import { createRequestHandler } from './app';

const PORT = parseInt(process.env.PORT ?? process.env.NETIOR_SERVICE_PORT ?? '3201', 10);
const DB_PATH = process.env.NETIOR_SERVICE_DB_PATH;

if (!DB_PATH) {
  console.error('Error: NETIOR_SERVICE_DB_PATH environment variable is required');
  process.exit(1);
}

initDatabase(DB_PATH);

const server = createServer(createRequestHandler());

server.listen(PORT, () => {
  console.log(`[netior-service] Listening on port ${PORT}`);
  console.log(`[netior-service] DB path: ${DB_PATH}`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    closeDatabase();
    server.close(() => process.exit(0));
  });
}
