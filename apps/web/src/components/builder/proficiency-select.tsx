import { cn } from '@/lib/utils';

const LEVELS = [
  { value: 1, label: 'Exposure' },
  { value: 2, label: 'Working' },
  { value: 3, label: 'Proficient' },
  { value: 4, label: 'Expert' },
] as const;

interface ProficiencySelectProps {
  value: number | null;
  onChange: (level: number | null) => void;
}

export function ProficiencySelect({ value, onChange }: ProficiencySelectProps) {
  return (
    <div className="flex flex-wrap sm:flex-nowrap rounded-lg border border-zinc-200 overflow-hidden dark:border-zinc-700 shadow-sm mt-3">
      {LEVELS.map((level) => {
        const isSelected = value === level.value;
        return (
          <button
            key={level.value}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange(isSelected ? null : level.value);
            }}
            className={cn(
              'flex-1 px-3 py-2 text-xs font-medium transition-colors border-r last:border-r-0 border-zinc-200 dark:border-zinc-700',
              isSelected
                ? 'bg-blue-600 text-white border-blue-600 z-10 relative'
                : 'bg-white text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700',
            )}
          >
            {level.label}
          </button>
        );
      })}
    </div>
  );
}
