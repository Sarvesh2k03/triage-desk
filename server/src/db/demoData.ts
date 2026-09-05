import type { Queryable } from './pool';

export async function seedDemoTickets(db: Queryable): Promise<void> {
  await db.query(`
    INSERT INTO tickets (
      id, title, description, requester_email, status, priority, category,
      summary, triage_source, triaged_at, created_at, updated_at
    ) VALUES
      (
        '11111111-1111-4111-8111-111111111101',
        'Checkout is failing for all customers',
        'Customers can add items to cart, but checkout returns a 500 error before payment. Support has received 18 reports this morning.',
        'maya@northstar.shop',
        'open',
        'urgent',
        'bug',
        'Checkout is failing before payment and blocking revenue for multiple customers.',
        'ai',
        now() - interval '18 minutes',
        now() - interval '22 minutes',
        now() - interval '18 minutes'
      ),
      (
        '11111111-1111-4111-8111-111111111102',
        'Password reset email never arrives',
        'The customer requested a password reset three times, but no email arrived. They are locked out before a billing review.',
        'devon@acme.io',
        'in_progress',
        'high',
        'account_access',
        'Customer is locked out because password reset emails are not arriving.',
        'ai',
        now() - interval '44 minutes',
        now() - interval '58 minutes',
        now() - interval '31 minutes'
      ),
      (
        '11111111-1111-4111-8111-111111111103',
        'Invoice export takes several minutes',
        'Exporting invoices for Q3 now takes four to five minutes and sometimes times out before the CSV downloads.',
        'lina@ledgerly.com',
        'open',
        'medium',
        'performance',
        'Invoice exports are slow and occasionally time out before download.',
        'ai',
        now() - interval '1 hour',
        now() - interval '1 hour 20 minutes',
        now() - interval '1 hour'
      ),
      (
        '11111111-1111-4111-8111-111111111104',
        'Charged twice for annual plan',
        'The customer was charged twice after upgrading to the annual plan and wants one payment refunded.',
        'samira@example.com',
        'resolved',
        'high',
        'billing',
        'Customer was double-charged for an annual upgrade and needs a refund.',
        'ai',
        now() - interval '2 hours',
        now() - interval '3 hours',
        now() - interval '45 minutes'
      ),
      (
        '11111111-1111-4111-8111-111111111105',
        'Add a dark mode option',
        'Several users asked whether the dashboard can support dark mode for late-night support shifts.',
        'oliver@helpdesk.dev',
        'open',
        'medium',
        'other',
        null,
        'manual',
        null,
        now() - interval '12 minutes',
        now() - interval '12 minutes'
      )
    ON CONFLICT (id) DO NOTHING
  `);
}
