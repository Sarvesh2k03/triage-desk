import { LABELS } from '../api/types';

interface BadgeProps {
  kind: 'status' | 'priority' | 'category' | 'source';
  value: string;
  title?: string;
}

export function Badge({ kind, value, title }: BadgeProps) {
  return (
    <span className={`badge badge--${kind} badge--${value}`} title={title}>
      {LABELS[value] ?? value}
    </span>
  );
}
