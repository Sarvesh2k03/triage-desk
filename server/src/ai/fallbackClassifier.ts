import type { TicketCategory, TicketPriority, TriageResult } from '../types/ticket';

const CATEGORY_RULES: ReadonlyArray<{ category: TicketCategory; keywords: readonly string[] }> = [
  {
    category: 'account_access',
    keywords: ['login', 'log in', 'sign in', 'password', 'locked out', '2fa', 'mfa', 'sso', 'access denied'],
  },
  {
    category: 'billing',
    keywords: ['bill', 'billing', 'invoice', 'charge', 'charged', 'refund', 'payment', 'subscription', 'pricing', 'card'],
  },
  {
    category: 'performance',
    keywords: ['slow', 'sluggish', 'timeout', 'timed out', 'lag', 'latency', 'hangs', 'freezes', 'taking forever'],
  },
  {
    category: 'feature_request',
    keywords: ['feature request', 'would be nice', 'please add', 'can you add', 'suggestion', 'wish', 'it would help if'],
  },
  {
    category: 'bug',
    keywords: ['bug', 'error', 'crash', 'broken', 'exception', 'stack trace', '500', 'not working', "doesn't work", 'fails'],
  },
];

const PRIORITY_RULES: ReadonlyArray<{ priority: TicketPriority; keywords: readonly string[] }> = [
  {
    priority: 'urgent',
    keywords: ['urgent', 'critical', 'outage', 'data loss', 'production down', 'all users', 'asap', 'emergency', 'cannot work'],
  },
  {
    priority: 'high',
    keywords: ['blocked', 'blocker', 'broken', 'crash', 'cannot', "can't", 'unable to', 'severe', 'immediately'],
  },
  {
    priority: 'low',
    keywords: ['question', 'wondering', 'nice to have', 'suggestion', 'feature request', 'cosmetic', 'typo', 'minor'],
  },
];

function firstMatch<T extends { keywords: readonly string[] }>(
  rules: readonly T[],
  haystack: string,
): T | undefined {
  return rules.find((rule) => rule.keywords.some((keyword) => haystack.includes(keyword)));
}

function truncate(text: string, max = 160): string {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= max) return collapsed;
  const cut = collapsed.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trimEnd()}...`;
}

export function classifyLocally(
  title: string,
  description: string,
  reason: string,
): TriageResult {
  const haystack = `${title}\n${description}`.toLowerCase();

  return {
    category: firstMatch(CATEGORY_RULES, haystack)?.category ?? 'other',
    priority: firstMatch(PRIORITY_RULES, haystack)?.priority ?? 'medium',
    summary: truncate(description.length > 0 ? description : title),
    source: 'fallback',
    reason,
  };
}
