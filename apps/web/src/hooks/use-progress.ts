import { useCallback } from 'react';
import { useBuilderStore } from '@/stores/builder-store';
import { saveProgress } from '@/lib/api/builder';

export function useProgress(functionCode: string) {
  const completedSteps = useBuilderStore((s) => s.completedSteps);
  const currentStep = useBuilderStore((s) => s.currentStep);

  const save = useCallback(
    async (lastAreaCode: string) => {
      try {
        await saveProgress({
          function_code: functionCode,
          completed_area_codes: Array.from(completedSteps),
          last_area_code: lastAreaCode,
        });
      } catch (err) {
        console.error('Progress save failed:', err);
      }
    },
    [functionCode, completedSteps],
  );

  return { save, completedSteps, currentStep };
}
