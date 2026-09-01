import { useEffect, useState } from 'react';
import { fetchBuilderPayload } from '@/lib/api/builder';
import { useBuilderStore } from '@/stores/builder-store';
import { useProgress } from '@/hooks/use-progress';
import { useClaimSync } from '@/hooks/use-claim-sync';
import type { BuilderPayload } from '@/lib/api/types';

import { ProgressSidebar } from './progress-sidebar';
import { CompetencyAreaStep } from './competency-area-step';
import { StepNavigation } from './step-navigation';
import { ProfileSummary } from './profile-summary';
import { Loader2 } from 'lucide-react';
import { UserMenu } from '../user-menu';

interface BuilderShellProps {
  roleCode: string;
}

export function BuilderShell({ roleCode }: BuilderShellProps) {

  const [payload, setPayload] = useState<BuilderPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'builder' | 'summary'>('builder');

  const initFromPayload = useBuilderStore((s) => s.initFromPayload);
  const setCurrentStep = useBuilderStore((s) => s.setCurrentStep);
  const setTotalSteps = useBuilderStore((s) => s.setTotalSteps);
  const markStepComplete = useBuilderStore((s) => s.markStepComplete);
  
  const currentStep = useBuilderStore((s) => s.currentStep);
  const completedSteps = useBuilderStore((s) => s.completedSteps);

  const { save: saveProgress } = useProgress(roleCode);
  const { flush: flushClaims } = useClaimSync();

  // Auto-scroll to top when step changes (must be above conditional returns)
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentStep]);

  useEffect(() => {
    fetchBuilderPayload(roleCode)
      .then((data) => {
        setPayload(data);
        
        // Find which step index to resume on
        const areas = data.role.competency_areas;
        let resumeStep = 0;
        if (data.progress?.last_area_code) {
          const idx = areas.findIndex(a => a.code === data.progress!.last_area_code);
          if (idx !== -1) resumeStep = idx;
        }

        setTotalSteps(areas.length);
        initFromPayload(
          data.claims,
          resumeStep,
          data.progress?.completed_area_codes ?? []
        );
      })
      .catch((err) => setError(err.message));
  }, [roleCode, initFromPayload, setTotalSteps]);

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-50 text-zinc-900">
        <div className="text-center">
          <h2 className="text-lg font-bold text-red-600 mb-2">Error loading builder</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950 text-zinc-900">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (viewMode === 'summary') {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950/50">
        <ProfileSummary 
          roleTree={payload.role} 
          onEdit={() => setViewMode('builder')} 
        />
      </div>
    );
  }

  const areas = payload.role.competency_areas;
  const currentArea = areas[currentStep];

  const handleNext = async () => {
    markStepComplete(currentArea.code);
    const nextStep = currentStep + 1;
    setCurrentStep(nextStep);
    
    // Save progress to backend
    const nextAreaCode = areas[nextStep]?.code ?? currentArea.code;
    await saveProgress(nextAreaCode);
  };

  const handlePrevious = async () => {
    const prevStep = currentStep - 1;
    setCurrentStep(prevStep);
    
    const prevAreaCode = areas[prevStep]?.code ?? currentArea.code;
    await saveProgress(prevAreaCode);
  };

  const handleComplete = async () => {
    markStepComplete(currentArea.code);
    await flushClaims(); // ensure all claims are saved before completing
    await saveProgress(currentArea.code);
    window.location.href = '/profile';
  };

  return (
    <div className="flex h-screen bg-white dark:bg-zinc-950 overflow-hidden relative">
      <UserMenu />
      <ProgressSidebar 
        areas={areas}
        currentStep={currentStep}
        completedSteps={completedSteps}
        onStepClick={(step) => setCurrentStep(step)}
      />
      
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto relative bg-zinc-50/50 dark:bg-zinc-950">
        <div className="flex-1 pb-24">
          <CompetencyAreaStep area={currentArea} />
        </div>
        
        <StepNavigation 
          onPrevious={handlePrevious}
          onNext={handleNext}
          onComplete={handleComplete}
        />
      </main>
    </div>
  );
}
