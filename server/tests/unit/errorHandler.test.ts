import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { errorHandler, notFoundHandler } from '../../src/middleware/errorHandler';
import { AppError } from '../../src/errors/AppError';

function buildRes() {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res as unknown as Response & { statusCode: number; body: any };
}

const next = (() => undefined) as NextFunction;

describe('notFoundHandler', () => {
  it('reports the unmatched method and path', () => {
    const res = buildRes();
    notFoundHandler({ method: 'GET', path: '/nope' } as Request, res);
    expect(res.statusCode).toBe(404);
    expect(res.body.error).toMatchObject({ code: 'NOT_FOUND' });
    expect(res.body.error.message).toContain('GET /nope');
  });
});

describe('errorHandler', () => {
  it('uses the status, code and message of an AppError', () => {
    const res = buildRes();
    errorHandler(AppError.notFound('Ticket 7 was not found'), {} as Request, res, next);
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({
      error: { code: 'NOT_FOUND', message: 'Ticket 7 was not found' },
    });
  });

  it('includes AppError details when present', () => {
    const res = buildRes();
    errorHandler(AppError.badRequest('Invalid', { title: 'too short' }), {} as Request, res, next);
    expect(res.body.error.details).toEqual({ title: 'too short' });
  });

  it('turns malformed JSON into a 400 rather than a 500', () => {
    const res = buildRes();
    const syntaxError = Object.assign(new SyntaxError('Unexpected token'), { body: '{oops' });
    errorHandler(syntaxError, {} as Request, res, next);
    expect(res.statusCode).toBe(400);
    expect(res.body.error.message).toMatch(/not valid JSON/);
  });

  it('handles a bare ZodError as a 400', () => {
    const res = buildRes();
    const zodError = z.object({ a: z.string() }).safeParse({}).error as z.ZodError;
    errorHandler(zodError, {} as Request, res, next);
    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('reports an unexpected error as a generic 500 with no internal detail', () => {
    const res = buildRes();
    errorHandler(new Error('connection terminated: password authentication failed'), {} as Request, res, next);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
    expect(JSON.stringify(res.body)).not.toContain('password');
  });

  it('handles a thrown non-Error value', () => {
    const res = buildRes();
    errorHandler('something went wrong', {} as Request, res, next);
    expect(res.statusCode).toBe(500);
  });
});

describe('AppError factories', () => {
  it.each([
    [AppError.badRequest('x'), 400, 'BAD_REQUEST'],
    [AppError.notFound(), 404, 'NOT_FOUND'],
    [AppError.tooManyRequests('x'), 429, 'RATE_LIMITED'],
    [AppError.internal(), 500, 'INTERNAL_ERROR'],
  ])('builds a %#: status and code', (error, status, code) => {
    expect(error.status).toBe(status);
    expect(error.code).toBe(code);
    expect(error).toBeInstanceOf(Error);
  });
});
