import { Icon } from '@iconify/react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { listPostVersions, readPostVersion, restorePostVersion } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { PostVersionItem, ReadVersionResponse } from '@/types';

interface Props {
  open: boolean;
  postId: string;
  hasUnsavedChanges: boolean;
  onOpenChange: (open: boolean) => void;
  onRestored: () => void;
}

export function PostHistoryDialog({ open, postId, hasUnsavedChanges, onOpenChange, onRestored }: Props) {
  const [versions, setVersions] = useState<PostVersionItem[]>([]);
  const [selected, setSelected] = useState('');
  const [revision, setRevision] = useState<ReadVersionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [reading, setReading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: retry reloads failed requests.
  useEffect(() => {
    if (!open) return;
    let active = true;
    setVersions([]);
    setSelected('');
    setRevision(null);
    setConfirm(false);
    setError('');
    setLoading(true);
    void listPostVersions(postId)
      .then((data) => {
        if (!active) return;
        setVersions(data.versions);
        setSelected(data.versions[0]?.version ?? '');
      })
      .catch((error: Error) => {
        if (active) setError(error.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, postId, retry]);

  useEffect(() => {
    if (!open || !selected) return;
    let active = true;
    setRevision(null);
    setError('');
    setConfirm(false);
    setReading(true);
    void readPostVersion(postId, selected)
      .then((data) => {
        if (active) setRevision(data);
      })
      .catch((error: Error) => {
        if (active) setError(error.message);
      })
      .finally(() => {
        if (active) setReading(false);
      });
    return () => {
      active = false;
    };
  }, [open, postId, selected]);

  async function restore() {
    if (!revision || hasUnsavedChanges || restoring) return;
    setRestoring(true);
    setError('');
    try {
      await restorePostVersion(postId, revision.version);
      toast.success('已恢复历史版本，恢复前的内容也已备份');
      onOpenChange(false);
      onRestored();
    } catch (error) {
      setError(error instanceof Error ? error.message : '恢复失败');
      setConfirm(false);
    } finally {
      setRestoring(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!restoring) onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-4xl overflow-y-auto" showClose={!restoring}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon icon="ri:history-line" className="size-5" />
            文章版本历史
          </DialogTitle>
          <DialogDescription>每次保存前保留旧内容。时间为备份时间（本机时区），恢复包含正文和文章属性。</DialogDescription>
        </DialogHeader>
        <p className="break-all font-mono text-muted-foreground text-xs">{postId}</p>
        {error && (
          <div
            role="alert"
            className="flex items-center justify-between gap-3 rounded-lg bg-destructive/10 p-3 text-destructive text-sm"
          >
            {error}
            <Button variant="outline" disabled={restoring} onClick={() => setRetry((value) => value + 1)}>
              重试
            </Button>
          </div>
        )}
        {loading ? (
          <output className="py-12 text-center text-muted-foreground">正在加载历史版本…</output>
        ) : versions.length === 0 ? (
          !error && (
            <p className="py-12 text-center text-muted-foreground">暂无历史版本。下一次保存文章时，会自动保留保存前的内容。</p>
          )
        ) : (
          <div className="grid gap-4 md:grid-cols-[15rem_minmax(0,1fr)]">
            <nav
              aria-label="历史版本列表"
              className="max-h-40 space-y-1 overflow-y-auto rounded-lg border p-2 md:max-h-[50dvh]"
            >
              {versions.map((item) => (
                <button
                  key={item.version}
                  type="button"
                  aria-pressed={selected === item.version}
                  disabled={restoring}
                  onClick={() => setSelected(item.version)}
                  className={cn(
                    'w-full rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted',
                    selected === item.version && 'bg-muted text-primary',
                  )}
                >
                  <span className="block font-mono text-xs">{item.savedAt}</span>
                  <span className="mt-1 block text-muted-foreground text-xs">{(item.size / 1024).toFixed(1)} KB</span>
                </button>
              ))}
            </nav>
            <section aria-label="历史版本内容" className="min-w-0 rounded-lg border bg-muted/30">
              {reading ? (
                <output className="p-6 text-muted-foreground text-sm">正在读取内容…</output>
              ) : (
                revision && (
                  <pre className="h-[40dvh] overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-xs leading-6 md:h-[50dvh]">
                    {revision.content}
                  </pre>
                )
              )}
            </section>
          </div>
        )}
        {hasUnsavedChanges && (
          <p className="text-amber-600 text-sm dark:text-amber-500">
            当前有未保存的改动。请先关闭此窗口并保存，再恢复历史版本。
          </p>
        )}
        {confirm && (
          <p role="alert" className="rounded-lg bg-muted p-3 text-sm">
            确定恢复这个版本？当前已保存的内容会先自动备份，可通过历史版本再次恢复。
          </p>
        )}
        <DialogFooter className="gap-2">
          <Button variant="outline" disabled={restoring} onClick={() => (confirm ? setConfirm(false) : onOpenChange(false))}>
            {confirm ? '取消恢复' : '关闭'}
          </Button>
          <Button
            disabled={!revision || reading || loading || hasUnsavedChanges || restoring}
            onClick={() => (confirm ? void restore() : setConfirm(true))}
          >
            {restoring ? '正在恢复…' : confirm ? '确认恢复' : '恢复此版本'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
