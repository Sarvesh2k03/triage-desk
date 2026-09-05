import { classifyLocally } from '../../src/ai/fallbackClassifier';

const REASON = 'Gemini service was unavailable';

describe('classifyLocally', () => {
  it('always reports itself as the fallback source and carries the reason', () => {
    const result = classifyLocally('Anything', 'Any description at all.', REASON);
    expect(result.source).toBe('fallback');
    expect(result.reason).toBe(REASON);
  });

  describe('category', () => {
    it.each([
      ['account_access', 'Cannot log in', 'My password reset email never arrives.'],
      ['billing', 'Wrong invoice', 'I was charged twice on my card this month.'],
      ['performance', 'Dashboard slow', 'Every page takes forever and eventually times out.'],
      ['feature_request', 'Idea', 'It would be nice if you could add dark mode. Suggestion only.'],
      ['bug', 'Broken chart', 'The report page throws a 500 error every time.'],
    ])('classifies %s', (expected, title, description) => {
      expect(classifyLocally(title, description, REASON).category).toBe(expected);
    });

    it('falls through to "other" when nothing matches', () => {
      expect(classifyLocally('Hello', 'Just saying thanks for the product.', REASON).category).toBe(
        'other',
      );
    });

    it('matches keywords regardless of case', () => {
      expect(classifyLocally('INVOICE PROBLEM', 'A REFUND PLEASE', REASON).category).toBe('billing');
    });

    it('prefers the more specific rule when several could match', () => {
      // Mentions both a login problem and an error; account_access is listed first.
      const result = classifyLocally('Login error', 'I get an error when I sign in.', REASON);
      expect(result.category).toBe('account_access');
    });
  });

  describe('priority', () => {
    it.each([
      ['urgent', 'Production down for all users, this is critical.'],
      ['high', 'I am completely blocked and cannot continue.'],
      ['low', 'Quick question about a minor typo on the pricing page.'],
    ])('assigns %s', (expected, description) => {
      expect(classifyLocally('Subject', description, REASON).priority).toBe(expected);
    });

    it('defaults to medium when no urgency signal is present', () => {
      expect(classifyLocally('Subject', 'The colour looks a bit off here.', REASON).priority).toBe(
        'medium',
      );
    });
  });

  describe('summary', () => {
    it('collapses whitespace in a short description', () => {
      expect(classifyLocally('T', 'Two   lines\n  of text.', REASON).summary).toBe(
        'Two lines of text.',
      );
    });

    it('truncates a long description on a word boundary', () => {
      const summary = classifyLocally('T', 'word '.repeat(100), REASON).summary;
      expect(summary.length).toBeLessThanOrEqual(164);
      expect(summary.endsWith('...')).toBe(true);
      expect(summary).not.toContain('wor...');
    });

    it('hard-cuts a single unbroken token that exceeds the limit', () => {
      const summary = classifyLocally('T', 'x'.repeat(300), REASON).summary;
      expect(summary.endsWith('...')).toBe(true);
      expect(summary.length).toBeLessThanOrEqual(164);
    });

    it('uses the title when the description is empty', () => {
      expect(classifyLocally('Only a title', '', REASON).summary).toBe('Only a title');
    });
  });
});
