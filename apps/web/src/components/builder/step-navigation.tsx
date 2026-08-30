import { ChevronLeft, ChevronRight, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBuilderStore } from '@/stores/builder-store';

interface StepNavigationProps {
  onPrevious: () => void;
  onNext: () => void;
  onComplete: () => void;
  isSyncing?: boolean;
}

export function StepNavigation({
  onPrevious,
  onNext,
  onComplete,
  isSyncing = false,
}: StepNavigationProps) {
  const currentStep = useBuilderStore((s) => s.currentStep);
  const totalSteps = useBuilderStore((s) => s.totalSteps);
  const hasDirty = useBuilderStore((s) => s.hasDirty());

  const isFirst = currentStep === 0;
  const isLast = currentStep === totalSteps - 1;

  // Show syncing if explicitly passed or if store has dirty items (which means a sync is pending/debouncing)
  const showSyncing = isSyncing || hasDirty;

  return (
    <div className="sticky bottom-0 bg-white/80 backdrop-blur-md border-t border-zinc-200 dark:bg-zinc-950/80 dark:border-zinc-800 p-4 px-6 z-20">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        
        <div className="flex items-center gap-4">
          <button
            onClick={onPrevious}
            disabled={isFirst}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors',
              isFirst
                ? 'text-zinc-300 cursor-not-allowed dark:text-zinc-600'
                : 'text-zinc-700 bg-zinc-100 hover:bg-zinc-200 dark:text-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700',
            )}
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </button>
          
          <div className="hidden sm:flex items-center gap-2 text-sm text-zinc-500 font-medium">
            {showSyncing ? (
              <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Saving...
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <Check className="w-3.5 h-3.5" />
                Saved
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-zinc-400">
            Step {currentStep + 1} of {totalSteps}
          </span>

          {isLast ? (
            <button
              onClick={onComplete}
              disabled={showSyncing}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              Complete Profile
            </button>
          ) : (
            <button
              onClick={onNext}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm"
            >
              Next Step
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
        
      </div>
    </div>
  );
}
