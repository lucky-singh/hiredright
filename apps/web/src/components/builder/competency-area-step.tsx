import type { CompetencyArea } from '@/lib/api/types';
import { ActivityItem } from './activity-item';

interface CompetencyAreaStepProps {
  area: CompetencyArea;
}

export function CompetencyAreaStep({ area }: CompetencyAreaStepProps) {
  return (
    <div className="max-w-4xl mx-auto py-8 px-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8">
        <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          {area.label}
        </h2>
        <p className="mt-3 text-lg text-zinc-600 dark:text-zinc-400">
          {area.description}
        </p>
      </div>

      <div className="space-y-4">
        {area.activities.map((activity) => (
          <ActivityItem key={activity.code} activity={activity} />
        ))}
      </div>
    </div>
  );
}
