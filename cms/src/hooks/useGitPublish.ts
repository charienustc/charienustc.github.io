/**
 * One-Click Publish Hook
 *
 * Owns the state behind the header's publish button: the repository status
 * shown in the dialog, the in-flight commit/push, and the last error.
 *
 * The status is re-read every time the dialog opens rather than held in a
 * store, because the working tree changes from outside the CMS too — switching
 * the editor tab to a terminal and committing there must be reflected on
 * reopen, not remembered from the first fetch.
 */

import { useCallback, useState } from 'react';

import { commitAndPush as commitAndPushApi, fetchGitStatus } from '@/lib/api';
import type { GitCommitPushResponse, GitStatusResponse } from '@/types';

export interface UseGitPublishResult {
  status: GitStatusResponse | null;
  /** True while the status is being read. */
  isLoadingStatus: boolean;
  /** True while lint/commit/push is running — the form is disabled during it. */
  isPublishing: boolean;
  /** Failure text to render in the dialog; cleared on each new attempt. */
  error: string | null;
  /** Successful result, or null before the first success. */
  result: GitCommitPushResponse | null;
  refreshStatus: () => Promise<void>;
  publish: (params: { type: string; scope?: string; description: string }) => Promise<void>;
  reset: () => void;
}

export function useGitPublish(): UseGitPublishResult {
  const [status, setStatus] = useState<GitStatusResponse | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GitCommitPushResponse | null>(null);

  const refreshStatus = useCallback(async () => {
    setIsLoadingStatus(true);
    setError(null);
    try {
      setStatus(await fetchGitStatus());
    } catch (err) {
      setStatus(null);
      setError(err instanceof Error ? err.message : '无法读取 git 状态');
    } finally {
      setIsLoadingStatus(false);
    }
  }, []);

  const publish = useCallback(async (params: { type: string; scope?: string; description: string }) => {
    setIsPublishing(true);
    setError(null);
    try {
      setResult(await commitAndPushApi(params));
      // The tree is clean now, so re-read rather than assuming: an upstream
      // that rejected the push would change what the dialog should say next.
      setStatus(await fetchGitStatus());
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交或推送失败');
    } finally {
      setIsPublishing(false);
    }
  }, []);

  /** Clear the previous attempt's outcome so a reopened dialog starts fresh. */
  const reset = useCallback(() => {
    setError(null);
    setResult(null);
  }, []);

  return { status, isLoadingStatus, isPublishing, error, result, refreshStatus, publish, reset };
}
