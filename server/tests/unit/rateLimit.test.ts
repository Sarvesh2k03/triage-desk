import type { NextFunction, Request, Response } from 'express';
import { TokenBucket, rateLimit } from '../../src/middleware/rateLimit';
import { AppError } from '../../src/errors/AppError';

describe('TokenBucket', () => {
  it('allows calls up to the capacity', () => {
    const bucket = new TokenBucket(3, 60, () => 0);
    expect([bucket.consume('ip'), bucket.consume('ip'), bucket.consume('ip')].map((r) => r.allowed)).toEqual(
      [true, true, true],
    );
  });

  it('rejects the call after the bucket is drained', () => {
    const bucket = new TokenBucket(1, 60, () => 0);
    bucket.consume('ip');
    expect(bucket.consume('ip').allowed).toBe(false);
  });

  it('reports how long to wait for the next token', () => {
    // 60 tokens/minute is one per second, so a drained bucket recovers in ~1s.
    const bucket = new TokenBucket(1, 60, () => 0);
    bucket.consume('ip');
    expect(bucket.consume('ip').retryAfterSeconds).toBe(1);
  });

  it('refills continuously rather than in fixed windows', () => {
    let now = 0;
    const bucket = new TokenBucket(2, 60, () => now);
    bucket.consume('ip');
    bucket.consume('ip');
    expect(bucket.consume('ip').allowed).toBe(false);

    now = 1_000; // one second later => one token back
    expect(bucket.consume('ip').allowed).toBe(true);
    expect(bucket.consume('ip').allowed).toBe(false);
  });

  it('never refills beyond the capacity', () => {
    let now = 0;
    const bucket = new TokenBucket(2, 60, () => now);
    now = 600_000; // ten minutes of idling
    expect(bucket.consume('ip').allowed).toBe(true);
    expect(bucket.consume('ip').allowed).toBe(true);
    expect(bucket.consume('ip').allowed).toBe(false);
  });

  it('tracks each client independently', () => {
    const bucket = new TokenBucket(1, 60, () => 0);
    expect(bucket.consume('a').allowed).toBe(true);
    expect(bucket.consume('b').allowed).toBe(true);
    expect(bucket.consume('a').allowed).toBe(false);
  });

  it('forgets every client on reset', () => {
    const bucket = new TokenBucket(1, 60, () => 0);
    bucket.consume('a');
    bucket.reset();
    expect(bucket.consume('a').allowed).toBe(true);
  });
});

describe('rateLimit middleware', () => {
  const buildReq = (ip?: string) => ({ ip }) as Request;
  const buildRes = () => ({ setHeader: jest.fn() }) as unknown as Response;

  it('calls next with no argument while tokens remain', () => {
    const next = jest.fn() as NextFunction;
    rateLimit(new TokenBucket(1, 60, () => 0))(buildReq('1.2.3.4'), buildRes(), next);
    expect(next).toHaveBeenCalledWith();
  });

  it('passes a 429 AppError to next once the bucket is empty', () => {
    const bucket = new TokenBucket(1, 60, () => 0);
    const middleware = rateLimit(bucket);
    const res = buildRes();
    const next = jest.fn() as NextFunction;

    middleware(buildReq('1.2.3.4'), res, jest.fn());
    middleware(buildReq('1.2.3.4'), res, next);

    const error = (next as jest.Mock).mock.calls[0]![0] as AppError;
    expect(error).toBeInstanceOf(AppError);
    expect(error.status).toBe(429);
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '1');
  });

  it('groups requests with no detectable IP under one shared bucket', () => {
    const middleware = rateLimit(new TokenBucket(1, 60, () => 0));
    const first = jest.fn() as NextFunction;
    const second = jest.fn() as NextFunction;

    middleware(buildReq(undefined), buildRes(), first);
    middleware(buildReq(undefined), buildRes(), second);

    expect(first).toHaveBeenCalledWith();
    expect((second as jest.Mock).mock.calls[0]![0]).toBeInstanceOf(AppError);
  });
});
