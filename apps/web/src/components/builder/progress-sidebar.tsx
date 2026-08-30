import { cn } from '@/lib/utils';
import type { CompetencyArea } from '@/lib/api/types';
import { CheckCircle2, Circle, CircleDot, LogOut } from 'lucide-react';

interface ProgressSidebarProps {
  areas: CompetencyArea[];
  currentStep: number;
  completedSteps: Set<string>;
  onStepClick: (step: number) => void;
}

export function ProgressSidebar({
  areas,
  currentStep,
  completedSteps,
  onStepClick,
}: ProgressSidebarProps) {
  const completedCount = completedSteps.size;
  const totalCount = areas.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <aside className="w-72 border-r border-zinc-200 bg-zinc-50 flex flex-col dark:border-zinc-800 dark:bg-zinc-900/50 flex-shrink-0 hidden lg:flex">
      <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
        <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
          Profile Builder
        </h2>
        <div className="mt-4 flex items-center gap-3">
          <div className="flex-1 h-2 bg-zinc-200 rounded-full overflow-hidden dark:bg-zinc-800">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
            {progressPct}%
          </span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-4">
        <ul className="space-y-1.5">
          {areas.map((area, idx) => {
            const isCompleted = completedSteps.has(area.code);
            const isCurrent = idx === currentStep;

            return (
              <li key={area.code}>
                <button
                  onClick={() => onStepClick(idx)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left transition-all duration-200 group',
                    isCurrent && 'bg-white shadow-sm border border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700',
                    !isCurrent && 'hover:bg-zinc-100 dark:hover:bg-zinc-800/80 border border-transparent',
                  )}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                  ) : isCurrent ? (
                    <CircleDot className="w-4 h-4 text-blue-600 shrink-0" />
                  ) : (
                    <Circle className="w-4 h-4 text-zinc-300 shrink-0 group-hover:text-zinc-400 dark:text-zinc-600" />
                  )}
                  <span
                    className={cn(
                      'truncate font-medium',
                      isCurrent && 'text-blue-900 dark:text-blue-100',
                      isCompleted && !isCurrent && 'text-zinc-700 dark:text-zinc-300',
                      !isCompleted && !isCurrent && 'text-zinc-500 dark:text-zinc-500 group-hover:text-zinc-700 dark:group-hover:text-zinc-300',
                    )}
                  >
                    {area.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-4 border-t border-zinc-200 dark:border-zinc-800">
        <button
          onClick={async () => {
            const { logoutUser } = await import('@/lib/api/auth');
            await logoutUser();
            window.location.href = '/login';
          }}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 text-sm font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800"
        >
          <LogOut className="w-4 h-4" />
          Log out
        </button>
      </div>
    </aside>
  );
}
