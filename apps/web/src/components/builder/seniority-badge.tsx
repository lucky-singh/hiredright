import { cn } from '@/lib/utils';

const LABELS: Record<string, string> = {
  junior: 'Junior',
  mid: 'Mid-level',
  senior: 'Senior',
  lead: 'Lead',
};

interface SeniorityBadgeProps {
  hint: string;
  className?: string;
}

export function SeniorityBadge({ hint, className }: SeniorityBadgeProps) {
  if (!hint || !LABELS[hint]) return null;

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full',
        'bg-amber-50 text-amber-700 border border-amber-200',
        'dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800',
        className,
      )}
    >
      Suggested for {LABELS[hint]}
    </span>
  );
}
