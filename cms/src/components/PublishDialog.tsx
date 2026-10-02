/**
 * Publish Dialog
 *
 * One-click commit-and-push for the whole working tree. Shows what is about to
 * be published, takes a conventional-commit subject, and reports exactly what
 * happened — including the git or lint output when it fails.
 */

import { Icon } from '@iconify/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { buildSubject, COMMIT_TYPES, type CommitType } from '@/lib/commit-message';
import { cn } from '@/lib/utils';

interface PublishDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-fills the description; normally the post being published. */
  suggestedDescription?: string;
  status: {
    branch: string;
    hasUpstream: boolean;
    changedFiles: string[];
    ahead: number;
  } | null;
  isLoadingStatus: boolean;
  isPublishing: boolean;
  error: string | null;
  result: { subject: string; committed: boolean; pushed: boolean; stat: string } | null;
  onPublish: (params: { type: string; scope: string; description: string }) => void;
}

/** Files listed before the list is collapsed behind a "+N more" line. */
const MAX_VISIBLE_FILES = 8;

export function PublishDialog({
  open,
  onOpenChange,
  suggestedDescription = '',
  status,
  isLoadingStatus,
  isPublishing,
  error,
  result,
  onPublish,
}: PublishDialogProps) {
  const [type, setType] = useState<CommitType>('content');
  const [scope, setScope] = useState('');
  const [description, setDescription] = useState(suggestedDescription);

  // Re-seed the description each time the dialog opens, so publishing a
  // different post does not inherit the previous title. Adjusting state during
  // render (rather than in an effect) is the pattern React recommends for
  // resetting on a prop change.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setDescription(suggestedDescription);
      setType('content');
      setScope('');
    }
  }

  // Focus the description on open: it is the only field most publishes touch.
  const descriptionRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open && !result) descriptionRef.current?.focus();
  }, [open, result]);

  const built = useMemo(() => buildSubject(type, scope, description), [type, scope, description]);
  const subject = 'subject' in built ? built.subject : '';
  const validationError = 'error' in built ? built.error : null;

  const hasChanges = (status?.changedFiles.length ?? 0) > 0;
  const hasAnythingToPublish = hasChanges || (status?.ahead ?? 0) > 0;
  const canPublish = hasAnythingToPublish && !validationError && !isPublishing && !isLoadingStatus;

  const visibleFiles = status?.changedFiles.slice(0, MAX_VISIBLE_FILES) ?? [];
  const hiddenCount = (status?.changedFiles.length ?? 0) - visibleFiles.length;

  const handleSubmit = () => {
    if (!canPublish) return;
    onPublish({ type, scope, description });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isPublishing && onOpenChange(next)}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon
              icon={result?.pushed ? 'ri:cloud-line' : 'ri:git-commit-line'}
              className={cn('size-5', result?.pushed ? 'text-green-500' : 'text-primary')}
            />
            {result?.pushed ? '已推送' : '提交并推送'}
          </DialogTitle>
          <DialogDescription>
            {result?.pushed
              ? '本地改动已经推到远程，等 GitHub Actions 构建完成后线上就会更新。'
              : '会提交工作区里的全部改动，推送前先跑一次 lint 检查。'}
          </DialogDescription>
        </DialogHeader>

        {/* Success state replaces the form: there is nothing left to fill in. */}
        {result ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-3">
              <p className="font-medium text-green-600 text-sm dark:text-green-400">{result.subject}</p>
              <p className="mt-1 text-muted-foreground text-xs">
                {result.committed ? '已创建提交' : '没有新改动，只推送了已有提交'} · 已推送到远程
              </p>
            </div>
            {result.stat && <pre className="max-h-40 overflow-auto rounded-lg bg-muted p-3 text-xs">{result.stat}</pre>}
          </div>
        ) : (
          <>
            {/* What is about to be committed */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 font-medium">
                  <Icon icon="ri:git-branch-line" className="size-4" />
                  {status?.branch ?? '—'}
                </span>
                <span className="text-muted-foreground text-xs">
                  {isLoadingStatus ? (
                    '读取中…'
                  ) : (
                    <>
                      {status?.changedFiles.length ?? 0} 个改动
                      {(status?.ahead ?? 0) > 0 && `，${status?.ahead} 个提交待推送`}
                    </>
                  )}
                </span>
              </div>

              {!isLoadingStatus && !status?.hasUpstream && (
                <p className="flex items-start gap-1.5 rounded-lg bg-destructive/10 p-2.5 text-destructive text-xs">
                  <Icon icon="ri:error-warning-line" className="mt-0.5 size-3.5 shrink-0" />
                  当前分支没有上游远程分支，请先在终端执行 git push -u origin {status?.branch}
                </p>
              )}

              {visibleFiles.length > 0 && (
                <ul className="max-h-32 space-y-0.5 overflow-auto rounded-lg bg-muted p-2.5 font-mono text-xs">
                  {visibleFiles.map((file) => (
                    <li key={file} className="truncate" title={file}>
                      {file}
                    </li>
                  ))}
                  {hiddenCount > 0 && <li className="text-muted-foreground">…还有 {hiddenCount} 个文件</li>}
                </ul>
              )}

              {!isLoadingStatus && !hasAnythingToPublish && (
                <p className="rounded-lg bg-muted p-2.5 text-muted-foreground text-xs">
                  没有需要提交的改动，也没有待推送的提交。
                </p>
              )}
            </div>

            {/* Commit subject builder */}
            <div className="space-y-2">
              <div className="flex gap-2">
                <select
                  aria-label="提交类型"
                  value={type}
                  onChange={(e) => setType(e.target.value as CommitType)}
                  disabled={isPublishing}
                  className="w-44 shrink-0 rounded-lg border border-input bg-background px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                >
                  {COMMIT_TYPES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  aria-label="scope（可选）"
                  placeholder="scope（可选）"
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                  disabled={isPublishing}
                  className="w-32 shrink-0 rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                />
              </div>
              {/* The description gets its own row: sharing one with the two
                  selects left it too narrow to read what had been typed. */}
              <input
                ref={descriptionRef}
                type="text"
                aria-label="提交说明"
                placeholder="一句话说明改了什么"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                disabled={isPublishing}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              />

              <p className="flex items-center gap-1.5 text-muted-foreground text-xs">
                <Icon icon="ri:terminal-line" className="size-3.5 shrink-0" />
                将提交为 <code className="rounded bg-muted px-1 py-0.5 text-foreground">{subject || '…'}</code>
              </p>

              {validationError && <p className="text-destructive text-xs">{validationError}</p>}
            </div>

            {/* Failure output — lint results land here too, so it is scrollable
                and preformatted rather than a one-line toast. */}
            {error && (
              <div className="space-y-1.5">
                <p className="flex items-center gap-1.5 font-medium text-destructive text-sm">
                  <Icon icon="ri:error-warning-line" className="size-4" />
                  操作失败
                </p>
                <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-destructive/10 p-3 text-destructive text-xs">
                  {error}
                </pre>
              </div>
            )}
          </>
        )}

        <DialogFooter>
          {result ? (
            <Button onClick={() => onOpenChange(false)}>完成</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPublishing}>
                取消
              </Button>
              <Button onClick={handleSubmit} disabled={!canPublish}>
                {isPublishing ? (
                  <>
                    <Icon icon="ri:loader-4-line" className="mr-1.5 size-4 animate-spin" />
                    提交并推送中…
                  </>
                ) : (
                  <>
                    <Icon icon="ri:cloud-line" className="mr-1.5 size-4" />
                    {hasChanges ? '提交并推送' : '推送已有提交'}
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
