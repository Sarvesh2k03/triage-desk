import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { AppError } from '../errors/AppError';

interface Bucket {
  tokens: number;
  lastRefill: number;
}

export class TokenBucket {
  private readonly buckets = new Map<string, Bucket>();
  private readonly refillPerMs: number;

  constructor(
    private readonly capacity: number,
    refillPerMinute: number,
    private readonly now: () => number = Date.now,
  ) {
    this.refillPerMs = refillPerMinute / 60_000;
  }

    consume(key: string): { allowed: boolean; retryAfterSeconds: number } {
    const now = this.now();
    const bucket = this.buckets.get(key) ?? { tokens: this.capacity, lastRefill: now };

    const refilled = (now - bucket.lastRefill) * this.refillPerMs;
    bucket.tokens = Math.min(this.capacity, bucket.tokens + refilled);
    bucket.lastRefill = now;

    if (bucket.tokens < 1) {
      this.buckets.set(key, bucket);
      const secondsToOneToken = (1 - bucket.tokens) / this.refillPerMs / 1000;
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(secondsToOneToken)) };
    }

    bucket.tokens -= 1;
    this.buckets.set(key, bucket);
    return { allowed: true, retryAfterSeconds: 0 };
  }

  reset(): void {
    this.buckets.clear();
  }
}

export function rateLimit(bucket: TokenBucket): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { allowed, retryAfterSeconds } = bucket.consume(req.ip ?? 'unknown');
    if (!allowed) {
      res.setHeader('Retry-After', String(retryAfterSeconds));
      next(
        AppError.tooManyRequests('Too many triage requests - please wait a moment', {
          retryAfterSeconds,
        }),
      );
      return;
    }
    next();
  };
}
