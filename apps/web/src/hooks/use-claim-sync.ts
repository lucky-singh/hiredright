import { useCallback, useEffect, useRef } from 'react';
import { useBuilderStore } from '@/stores/builder-store';
import { syncClaims } from '@/lib/api/builder';

const DEBOUNCE_MS = 500;

export function useClaimSync() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSyncing = useRef(false);

  const flush = useCallback(async () => {
    if (isSyncing.current) return;

    const deltas = useBuilderStore.getState().getDirtyDeltas();
    if (deltas.length === 0) return;

    isSyncing.current = true;
    const codes = deltas.map((d) => d.activity_code);

    try {
      await syncClaims(deltas);
      useBuilderStore.getState().clearDirty(codes);
    } catch (err) {
      console.error('Claim sync failed, will retry on next change:', err);
    } finally {
      isSyncing.current = false;
    }
  }, []);

  const scheduleFlush = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flush, DEBOUNCE_MS);
  }, [flush]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      flush();
    };
  }, [flush]);

  return { scheduleFlush, flush };
}
