/**
 * Moments Feed State
 *
 * Loads the moments ("碎碎念") feed for the dashboard tab. Kept separate from
 * `useDashboardState` because the two collections share no state: refreshing
 * moments must not refetch every post, and a moments failure should not take
 * the post dashboard down with it.
 */

import { useCallback, useEffect, useState } from 'react';
import { listMoments } from '@/lib/api';
import type { ListMomentsResponse } from '@/types';

export interface UseMomentsStateResult {
  data: ListMomentsResponse | null;
  isLoading: boolean;
  error: string | null;
  /** Re-fetch the feed; called after a write or delete */
  refresh: () => void;
}

export function useMomentsState(active: boolean): UseMomentsStateResult {
  const [data, setData] = useState<ListMomentsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The fetch itself is a named callback rather than an inline effect body so
  // `refresh` can call the very same function. An incrementing "nonce" in the
  // dependency array would do the same thing, but it reads as an unused
  // dependency and needs a lint suppression to stay honest.
  const load = useCallback(async (isCancelled: () => boolean) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await listMoments();
      if (!isCancelled()) setData(result);
    } catch (err: unknown) {
      if (!isCancelled()) setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (!isCancelled()) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Only fetch once the tab is actually opened: the feed is not needed for
    // the dashboard to be useful, and an unused request is just latency.
    if (!active) return;

    let cancelled = false;
    void load(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [active, load]);

  const refresh = useCallback(() => {
    void load(() => false);
  }, [load]);

  return { data, isLoading, error, refresh };
}
