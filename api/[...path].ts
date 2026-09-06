import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApp } from '../server/src/app';
import { migrate } from '../server/src/db/migrate';

const app = createApp();
const ready = migrate();

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  await ready;
  return app(req, res);
}
