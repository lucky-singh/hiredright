// --- Taxonomy (read-only from GET /builder/{code}/) ---

export interface JobRole {
  code: string;
  label: string;
  description: string;
}

export interface Activity {
  code: string;
  label: string;
  help_text: string;
  claim_type: 'activity' | 'proficiency' | 'trait';
  seniority_hint: '' | 'junior' | 'mid' | 'senior' | 'lead';
  variants: string[];
}

export interface CompetencyArea {
  code: string;
  label: string;
  description: string;
  activities: Activity[];
}

export interface RoleTree {
  code: string;
  label: string;
  description: string;
  competency_areas: CompetencyArea[];
}

// --- Claims ---

export interface ExistingClaim {
  activity_code: string;
  proficiency: number | null;
  years_experience: string | null;
  last_used_year: number | null;
  variants: string[];
  is_ai_inferred?: boolean;
}

export interface ClaimDelta {
  activity_code: string;
  claimed: boolean;
  proficiency?: number | null;
  years_experience?: number | null;
  last_used_year?: number | null;
  variants?: string[];
}

export interface ClaimSyncResponse {
  status: string;
  synced_count: number;
}

// --- Progress ---

export interface BuilderProgress {
  role_code: string;
  completed_area_codes: string[];
  last_area_code: string;
  completed_at: string | null;
}

// --- Dense payload ---

export interface BuilderPayload {
  role: RoleTree;
  claims: ExistingClaim[];
  progress: BuilderProgress | null;
  years_experience: string | null;
}
