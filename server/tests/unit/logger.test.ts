import { logger } from '../../src/utils/logger';

describe('logger', () => {
  const original = process.env.NODE_ENV;
  let spies: jest.SpyInstance[];

  beforeEach(() => {
    process.env.NODE_ENV = 'development';
    spies = [
      jest.spyOn(console, 'log').mockImplementation(() => undefined),
      jest.spyOn(console, 'warn').mockImplementation(() => undefined),
      jest.spyOn(console, 'error').mockImplementation(() => undefined),
    ];
  });

  afterEach(() => {
    process.env.NODE_ENV = original;
    spies.forEach((spy) => spy.mockRestore());
  });

  it.each([
    ['info', 'log'],
    ['warn', 'warn'],
    ['error', 'error'],
  ] as const)('routes %s to console.%s', (level, consoleMethod) => {
    logger[level]('something happened');
    expect(console[consoleMethod]).toHaveBeenCalledTimes(1);
  });

  it('emits one line of JSON containing the message, level and timestamp', () => {
    logger.info('server listening');

    const line = (console.log as jest.Mock).mock.calls[0]![0] as string;
    expect(line).not.toContain('\n');
    expect(JSON.parse(line)).toMatchObject({ level: 'info', message: 'server listening' });
    expect(typeof JSON.parse(line).time).toBe('string');
  });

  it('merges structured context into the line', () => {
    logger.error('call failed', { status: 503, model: 'gemini-3.7-flash' });
    const parsed = JSON.parse((console.error as jest.Mock).mock.calls[0]![0] as string);
    expect(parsed).toMatchObject({ status: 503, model: 'gemini-3.7-flash' });
  });

  it('stays silent while NODE_ENV is test', () => {
    process.env.NODE_ENV = 'test';
    logger.info('should not appear');
    expect(console.log).not.toHaveBeenCalled();
  });
});
