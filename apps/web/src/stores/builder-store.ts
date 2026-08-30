import { create } from 'zustand';
import type { ExistingClaim, ClaimDelta } from '@/lib/api/types';

export interface LocalClaim {
  claimed: boolean;
  proficiency: number | null;
  yearsExperience: number | null;
  lastUsedYear: number | null;
  variants: string[];
}

interface BuilderState {
  claims: Record<string, LocalClaim>;
  dirty: Set<string>;
  currentStep: number;
  completedSteps: Set<string>;
  totalSteps: number;

  initFromPayload: (existing: ExistingClaim[], resumeStep: number, completedAreas: string[]) => void;
  toggleClaim: (code: string) => void;
  setProficiency: (code: string, level: number | null) => void;
  setVariants: (code: string, variants: string[]) => void;
  setLastUsedYear: (code: string, year: number | null) => void;
  markStepComplete: (areaCode: string) => void;
  setCurrentStep: (step: number) => void;
  setTotalSteps: (total: number) => void;
  getDirtyDeltas: () => ClaimDelta[];
  clearDirty: (codes: string[]) => void;
  hasDirty: () => boolean;
}

const DEFAULT_CLAIM: LocalClaim = {
  claimed: false,
  proficiency: null,
  yearsExperience: null,
  lastUsedYear: null,
  variants: [],
};

export const useBuilderStore = create<BuilderState>((set, get) => ({
  claims: {},
  dirty: new Set<string>(),
  currentStep: 0,
  completedSteps: new Set<string>(),
  totalSteps: 0,

  initFromPayload: (existing, resumeStep, completedAreas) => {
    const claims: Record<string, LocalClaim> = {};
    for (const claim of existing) {
      claims[claim.activity_code] = {
        claimed: true,
        proficiency: claim.proficiency,
        yearsExperience: claim.years_experience ? Number(claim.years_experience) : null,
        lastUsedYear: claim.last_used_year,
        variants: claim.variants ?? [],
      };
    }
    set({
      claims,
      dirty: new Set<string>(),
      currentStep: resumeStep,
      completedSteps: new Set(completedAreas),
    });
  },

  toggleClaim: (code) => {
    set((state) => {
      const existing = state.claims[code] ?? { ...DEFAULT_CLAIM };
      const newDirty = new Set(state.dirty);
      newDirty.add(code);
      return {
        claims: {
          ...state.claims,
          [code]: existing.claimed
            ? { ...DEFAULT_CLAIM }
            : { ...existing, claimed: true },
        },
        dirty: newDirty,
      };
    });
  },

  setProficiency: (code, level) => {
    set((state) => {
      const existing = state.claims[code] ?? { ...DEFAULT_CLAIM, claimed: true };
      const newDirty = new Set(state.dirty);
      newDirty.add(code);
      return {
        claims: { ...state.claims, [code]: { ...existing, proficiency: level } },
        dirty: newDirty,
      };
    });
  },

  setVariants: (code, variants) => {
    set((state) => {
      const existing = state.claims[code] ?? { ...DEFAULT_CLAIM, claimed: true };
      const newDirty = new Set(state.dirty);
      newDirty.add(code);
      return {
        claims: { ...state.claims, [code]: { ...existing, variants } },
        dirty: newDirty,
      };
    });
  },

  setLastUsedYear: (code, year) => {
    set((state) => {
      const existing = state.claims[code] ?? { ...DEFAULT_CLAIM, claimed: true };
      const newDirty = new Set(state.dirty);
      newDirty.add(code);
      return {
        claims: { ...state.claims, [code]: { ...existing, lastUsedYear: year } },
        dirty: newDirty,
      };
    });
  },

  markStepComplete: (areaCode) => {
    set((state) => {
      const newCompleted = new Set(state.completedSteps);
      newCompleted.add(areaCode);
      return { completedSteps: newCompleted };
    });
  },

  setCurrentStep: (step) => set({ currentStep: step }),
  setTotalSteps: (total) => set({ totalSteps: total }),

  getDirtyDeltas: () => {
    const { claims, dirty } = get();
    const deltas: ClaimDelta[] = [];
    for (const code of dirty) {
      const claim = claims[code];
      if (!claim) continue;
      deltas.push({
        activity_code: code,
        claimed: claim.claimed,
        ...(claim.claimed
          ? {
              proficiency: claim.proficiency,
              years_experience: claim.yearsExperience,
              last_used_year: claim.lastUsedYear,
              variants: claim.variants,
            }
          : {}),
      });
    }
    return deltas;
  },

  clearDirty: (codes) => {
    set((state) => {
      const newDirty = new Set(state.dirty);
      for (const code of codes) newDirty.delete(code);
      return { dirty: newDirty };
    });
  },

  hasDirty: () => get().dirty.size > 0,
}));
