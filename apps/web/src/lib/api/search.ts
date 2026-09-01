import { apiFetch } from './client';

export interface Skill {
  code: string;
  label: string;
  help_text: string;
  claim_type: 'activity' | 'proficiency' | 'trait';
  seniority_hint: '' | 'junior' | 'mid' | 'senior' | 'lead';
  variants: string[];
  areas: { code: string; label: string; sort_order: number; role_code: string; role_label: string }[];
  proficiency?: number | null;
  years_experience?: number | null;
  last_used_year?: number | null;
}

export interface SkillListResponse {
  count: number;
  results: Skill[];
}

export interface SearchQuery {
  required_activity_codes: string[];
  optional_activity_codes: string[];
  required_variants: Record<string, string[]>;
  limit: number;
  include_near_misses: boolean;
}

export interface SearchResult {
  profile_id: number;
  score: number;
  score_pct: number;
  meets_requirements: boolean;
  matched_required: Skill[];
  missing_required: Skill[];
  matched_optional: Skill[];
  other_skills?: Skill[];
}

export interface SearchResponse {
  count: number;
  results: SearchResult[];
}

export async function getSkills(roleCode: string, query: string = ''): Promise<SkillListResponse> {
  const params = new URLSearchParams();
  if (roleCode) params.append('role', roleCode);
  if (query) params.append('q', query);
  
  return apiFetch<SkillListResponse>(`/skills/?${params.toString()}`);
}

export async function searchCandidates(query: SearchQuery): Promise<SearchResponse> {
  return apiFetch<SearchResponse>('/search/', {
    method: 'POST',
    body: JSON.stringify(query),
  });
}
