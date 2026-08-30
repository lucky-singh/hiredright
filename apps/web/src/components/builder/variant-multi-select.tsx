import { cn } from '@/lib/utils';

interface VariantMultiSelectProps {
  available: string[];
  selected: string[];
  onChange: (variants: string[]) => void;
}

export function VariantMultiSelect({
  available,
  selected,
  onChange,
}: VariantMultiSelectProps) {
  if (available.length === 0) return null;

  const toggleVariant = (variant: string) => {
    if (selected.includes(variant)) {
      onChange(selected.filter((v) => v !== variant));
    } else {
      onChange([...selected, variant]);
    }
  };

  return (
    <div className="mt-3">
      <p className="text-xs font-medium text-zinc-500 mb-2">Versions used:</p>
      <div className="flex flex-wrap gap-2">
        {available.map((variant) => {
          const isSelected = selected.includes(variant);
          return (
            <button
              key={variant}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleVariant(variant);
              }}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium transition-all border',
                isSelected
                  ? 'bg-blue-100 text-blue-700 border-blue-300 shadow-sm dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800'
                  : 'bg-white text-zinc-600 border-zinc-200 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700 dark:hover:border-blue-600 dark:hover:bg-zinc-800/80',
              )}
            >
              {variant}
            </button>
          );
        })}
      </div>
    </div>
  );
}
