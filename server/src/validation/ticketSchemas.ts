import { z } from 'zod';
import { TICKET_CATEGORIES, TICKET_PRIORITIES, TICKET_STATUSES } from '../types/ticket';

const title = z.string().trim().min(3, 'title must be at least 3 characters').max(160);
const description = z.string().trim().min(10, 'description must be at least 10 characters').max(5_000);
const requesterEmail = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('must be a valid email address').max(254));

export const createTicketSchema = z.object({
  title,
  description,
  requesterEmail,
  status: z.enum(TICKET_STATUSES).optional(),
  priority: z.enum(TICKET_PRIORITIES).optional(),
  category: z.enum(TICKET_CATEGORIES).optional(),
});

export const updateTicketSchema = z
  .object({
    title: title.optional(),
    description: description.optional(),
    requesterEmail: requesterEmail.optional(),
    status: z.enum(TICKET_STATUSES).optional(),
    priority: z.enum(TICKET_PRIORITIES).optional(),
    category: z.enum(TICKET_CATEGORIES).optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: 'provide at least one field to update',
  });

export const listTicketsQuerySchema = z.object({
  status: z.enum(TICKET_STATUSES).optional(),
  priority: z.enum(TICKET_PRIORITIES).optional(),
  category: z.enum(TICKET_CATEGORIES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});

export const ticketIdParamSchema = z.object({
  id: z.string().uuid('ticket id must be a UUID'),
});

export type CreateTicketBody = z.infer<typeof createTicketSchema>;
export type UpdateTicketBody = z.infer<typeof updateTicketSchema>;
export type ListTicketsQuery = z.infer<typeof listTicketsQuerySchema>;
