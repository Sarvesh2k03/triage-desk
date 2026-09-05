import { useState, type FormEvent } from 'react';
import { ApiError } from '../api/client';
import type { NewTicket } from '../api/types';

interface TicketFormProps {
  onCreate: (ticket: NewTicket) => Promise<void>;
}

const EMPTY: NewTicket = { title: '', description: '', requesterEmail: '' };

export function TicketForm({ onCreate }: TicketFormProps) {
  const [values, setValues] = useState<NewTicket>(EMPTY);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const set = (field: keyof NewTicket) => (event: { target: { value: string } }) =>
    setValues((current) => ({ ...current, [field]: event.target.value }));

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setFieldErrors({});
    setFormError(null);

    try {
      await onCreate(values);
      setValues(EMPTY);
    } catch (caught) {
      if (caught instanceof ApiError && caught.details) setFieldErrors(caught.details);
      else setFormError(caught instanceof ApiError ? caught.message : 'Could not create the ticket.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="card ticket-form" onSubmit={handleSubmit} noValidate>
      <div>
        <p className="eyebrow">Intake</p>
        <h2>New ticket</h2>
      </div>

      <label>
        Subject
        <input value={values.title} onChange={set('title')} placeholder="Invoice export never finishes" />
        {fieldErrors.title && <small className="field-error">{fieldErrors.title}</small>}
      </label>

      <label>
        Requester email
        <input value={values.requesterEmail} onChange={set('requesterEmail')} placeholder="dana@example.com" />
        {fieldErrors.requesterEmail && <small className="field-error">{fieldErrors.requesterEmail}</small>}
      </label>

      <label>
        What happened?
        <textarea
          rows={5}
          value={values.description}
          onChange={set('description')}
          placeholder="Clicking export on the billing page spins forever and no file downloads."
        />
        {fieldErrors.description && <small className="field-error">{fieldErrors.description}</small>}
      </label>

      {formError && <p className="form-error">{formError}</p>}

      <button type="submit" disabled={submitting}>
        {submitting ? 'Creating...' : 'Create ticket'}
      </button>
    </form>
  );
}
