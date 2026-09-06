import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApp } from '../server/src/app';
import { migrate } from '../server/src/db/migrate';
import { logger } from '../server/src/utils/logger';

const app = createApp();

/**
 * Schema application, run once per warm instance.
 *
 * Deliberately *not* started at module scope: a rejection there is an
 * unhandled promise rejection, which Node turns into a hard process exit and
 * Vercel reports as an opaque FUNCTION_INVOCATION_FAILED with no message.
 * Starting it lazily inside the handler means a database problem surfaces as
 * a readable 503 instead.
 */
let ready: Promise<void> | undefined;

function ensureReady(): Promise<void> {
  // Clearing the memo on failure matters: a cached rejected promise would
  // poison every later request on this instance, so a transient database
  // blip would look permanent until the container recycled.
  if (!ready) {
    ready = migrate().catch((error: unknown) => {
      ready = undefined;
      throw error;
    });
  }
  return ready;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    await ensureReady();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('database initialisation failed', { error: message });
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        error: {
          code: 'DATABASE_UNAVAILABLE',
          message: 'The API could not reach its database.',
          detail: message,
        },
      }),
    );
    return;
  }

  return app(req, res);
}
