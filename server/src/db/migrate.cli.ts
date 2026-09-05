import { closePool } from './pool';
import { migrate } from './migrate';
import { logger } from '../utils/logger';

migrate()
  .then(() => closePool())
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    logger.error('migration failed', { error: String(error) });
    process.exit(1);
  });
