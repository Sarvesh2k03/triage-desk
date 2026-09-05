import { createApp } from './app';
import { env } from './config/env';
import { closePool } from './db/pool';
import { migrate } from './db/migrate';
import { logger } from './utils/logger';

async function main(): Promise<void> {
  await migrate();

  const server = createApp().listen(env.PORT, () => {
    logger.info('server listening', { port: env.PORT, env: env.NODE_ENV });
  });

  const shutdown = (signal: string) => {
    logger.info('shutting down', { signal });
    server.close(() => {
      void closePool().finally(() => process.exit(0));
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error: unknown) => {
  logger.error('failed to start server', { error: String(error) });
  process.exit(1);
});
