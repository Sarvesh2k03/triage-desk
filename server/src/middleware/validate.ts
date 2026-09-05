import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { z } from 'zod';
import { AppError } from '../errors/AppError';

type Source = 'body' | 'query' | 'params';

function toDetails(error: z.ZodError): Record<string, string> {
  const details: Record<string, string> = {};
  for (const issue of error.issues) {
    details[issue.path.join('.') || '_'] = issue.message;
  }
  return details;
}

export function validate(schema: z.ZodType, source: Source = 'body'): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      next(AppError.badRequest(`Invalid request ${source}`, toDetails(result.error)));
      return;
    }
    Object.defineProperty(req, source, {
      value: result.data,
      writable: true,
      configurable: true,
      enumerable: true,
    });
    next();
  };
}
