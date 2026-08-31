import { cn } from '@/lib/utils';
import type { Activity } from '@/lib/api/types';
import { useBuilderStore } from '@/stores/builder-store';
import { useClaimSync } from '@/hooks/use-claim-sync';
import { Bot }
from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { ProficiencySelect } from './proficiency-select';
import { VariantMultiSelect } from './variant-multi-select';

interface ActivityItemProps {
  activity: Activity;
}

const SENIORITY_LABELS: Record<string, string> = {
  junior: 'Junior',
  mid: 'Mid-level',
  senior: 'Senior',
  lead: 'Lead',
};

export function ActivityItem({ activity }: ActivityItemProps) {
  const claim = useBuilderStore((s) => s.claims[activity.code]);
  const isClaimed = claim?.claimed ?? false;

  const toggleClaim = useBuilderStore((s) => s.toggleClaim);
  const setProficiency = useBuilderStore((s) => s.setProficiency);
  const setVariants = useBuilderStore((s) => s.setVariants);
  
  const { scheduleFlush } = useClaimSync();

  const handleToggle = () => {
    toggleClaim(activity.code);
    scheduleFlush();
  };

  const handleProficiency = (level: number | null) => {
    setProficiency(activity.code, level);
    scheduleFlush();
  };

  const handleVariants = (variants: string[]) => {
    setVariants(activity.code, variants);
    scheduleFlush();
  };

  return (
    <div
      onClick={handleToggle}
      className={cn(
        'group relative p-5 rounded-xl border transition-all duration-200 cursor-pointer',
        isClaimed
          ? 'bg-blue-50 border-blue-200 shadow-sm dark:bg-blue-900/40 dark:border-blue-700'
          : 'bg-white border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800 dark:hover:border-zinc-700 dark:hover:bg-zinc-800/80',
      )}
    >
      <div className="flex items-start gap-4">
        <div className="mt-1">
          <Checkbox 
            checked={isClaimed} 
            onCheckedChange={() => {
              toggleClaim(activity.code);
            }}
            className={cn(
              "w-5 h-5 transition-colors border-2",
              isClaimed 
                ? "bg-blue-600 border-blue-600 text-white dark:bg-blue-500 dark:border-blue-500" 
                : "border-zinc-300 dark:border-zinc-600"
            )}
          />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center flex-wrap gap-2">
            <h4 className={cn(
              "text-base font-semibold transition-colors flex items-center gap-2",
              isClaimed ? "text-blue-900 dark:text-blue-100" : "text-zinc-900 dark:text-zinc-100"
            )}>
              {activity.label}
              {claim?.isAiInferred && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                  <Bot className="w-3 h-3 mr-1 inline" /> AI
                </span>
              )}
            </h4>
            
            {activity.claim_type === 'trait' && (
              <span className="inline-flex px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                Not Scored
              </span>
            )}
            
            {activity.seniority_hint && (
              <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800">
                Suggested for {SENIORITY_LABELS[activity.seniority_hint] || activity.seniority_hint}
              </span>
            )}
          </div>
          
          {activity.help_text && (
            <p className="mt-1.5 text-sm text-zinc-500 leading-relaxed dark:text-zinc-400">
              {activity.help_text}
            </p>
          )}

          {/* Always visible inline controls */}
          <div className="mt-4">
            {activity.claim_type === 'proficiency' && (
              <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/50">
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">
                  Proficiency level:
                </p>
                <ProficiencySelect
                  value={claim?.proficiency ?? null}
                  onChange={handleProficiency}
                />
              </div>
            )}

            {activity.variants && activity.variants.length > 0 && (
              <div className={cn("pt-3", activity.claim_type === 'activity' ? "border-t border-zinc-100 dark:border-zinc-800/50" : "mt-2")}>
                <VariantMultiSelect
                  available={activity.variants}
                  selected={claim?.variants ?? []}
                  onChange={handleVariants}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
