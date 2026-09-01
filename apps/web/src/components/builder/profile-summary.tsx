import type { RoleTree } from '@/lib/api/types';
import { useBuilderStore } from '@/stores/builder-store';
import { Badge } from '@/components/ui/badge';
import { Pencil } from 'lucide-react';

interface ProfileSummaryProps {
  roleTree: RoleTree;
  onEdit: () => void;
}

const PROFICIENCY_LABELS: Record<number, string> = {
  1: 'Exposure',
  2: 'Working',
  3: 'Proficient',
  4: 'Expert',
};

export function ProfileSummary({ roleTree, onEdit }: ProfileSummaryProps) {
  const claims = useBuilderStore((s) => s.claims);

  // Group claimed activities by competency area
  const summaryData = roleTree.competency_areas
    .map((area) => {
      const claimedActivities = area.activities.filter(
        (activity) => claims[activity.code]?.claimed,
      );
      return {
        ...area,
        claimedActivities,
      };
    })
    .filter((area) => area.claimedActivities.length > 0);

  return (
    <div className="max-w-4xl mx-auto py-12 px-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Profile Summary
          </h1>
          <p className="mt-2 text-lg text-zinc-600 dark:text-zinc-400">
            Review your {roleTree.label} experience before submitting.
          </p>
        </div>
        <button
          onClick={onEdit}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-zinc-100 text-zinc-700 hover:bg-zinc-200 transition-colors dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
        >
          <Pencil className="w-4 h-4" />
          Edit Profile
        </button>
      </div>

      <div className="space-y-8">
        {summaryData.length === 0 ? (
          <div className="text-center py-12 bg-zinc-50 rounded-xl border border-dashed border-zinc-300 dark:bg-zinc-900/50 dark:border-zinc-800">
            <p className="text-zinc-500 dark:text-zinc-400">No skills claimed yet.</p>
          </div>
        ) : (
          summaryData.map((area) => (
            <div
              key={area.code}
              className="bg-white rounded-xl border border-zinc-200 overflow-hidden dark:bg-zinc-950 dark:border-zinc-800"
            >
              <div className="px-6 py-4 bg-zinc-50 border-b border-zinc-200 dark:bg-zinc-900/50 dark:border-zinc-800">
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  {area.label}
                </h3>
              </div>
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                {area.claimedActivities.map((activity) => {
                  const claim = claims[activity.code]!;
                  return (
                    <li key={activity.code} className="p-6">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div>
                          <h4 className="font-medium text-zinc-900 dark:text-zinc-100">
                            {activity.label}
                          </h4>
                          {activity.claim_type === 'trait' && (
                            <span className="inline-block mt-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                              Self-reported trait
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {activity.claim_type === 'proficiency' && claim.proficiency && (
                            <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800">
                              {PROFICIENCY_LABELS[claim.proficiency]}
                            </Badge>
                          )}
                          {claim.variants.length > 0 &&
                            claim.variants.map((v) => (
                              <Badge key={v} variant="outline" className="text-zinc-600 border-zinc-300 dark:text-zinc-400 dark:border-zinc-700">
                                {v}
                              </Badge>
                            ))}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </div>
      
      {/* Final Action / Next Step */}
      <div className="mt-12 pt-8 border-t border-zinc-200 dark:border-zinc-800 text-center">
        <a 
          href="/profile"
          className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-8 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
        >
          Finish & View Global Profile
        </a>
      </div>
    </div>
  );
}
