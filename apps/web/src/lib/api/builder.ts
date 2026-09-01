import type {
  BuilderPayload,
  BuilderProgress,
  ClaimDelta,
  ClaimSyncResponse,
  JobRole,
} from './types';
import { apiFetch } from './client';

export function fetchFunctions(): Promise<JobRole[]> {
  return apiFetch<JobRole[]>('/roles/');
}

export function fetchBuilderPayload(
  roleCode: string,
): Promise<BuilderPayload> {
  return apiFetch<BuilderPayload>(`/builder/${roleCode}/`);
}

export function syncClaims(
  claims: ClaimDelta[],
): Promise<ClaimSyncResponse> {
  return apiFetch<ClaimSyncResponse>('/builder/claims/', {
    method: 'POST',
    body: JSON.stringify({ claims }),
  });
}

export function saveProgress(
  progress: Omit<BuilderProgress, 'completed_at'>,
): Promise<BuilderProgress> {
  return apiFetch<BuilderProgress>('/builder/progress/', {
    method: 'PUT',
    body: JSON.stringify(progress),
  });
}
