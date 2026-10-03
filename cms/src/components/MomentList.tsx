/**
 * Moment List
 *
 * The dashboard's moments ("碎碎念") tab: the feed as the site will render it,
 * each entry with edit and delete actions. Editing hands off to the composer
 * rather than editing in place, so there is exactly one place that writes a
 * moment and the version-retention rule cannot be bypassed.
 */

import { Icon } from '@iconify/react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { deleteMoment } from '@/lib/api';
import type { MomentListItem } from '@/types';

interface MomentListProps {
  moments: MomentListItem[];
  onChanged: () => void;
  onCompose: () => void;
  /** Hand a moment to the composer for editing */
  onEdit: (momentId: string) => void;
}

export function MomentList({ moments, onChanged, onCompose, onEdit }: MomentListProps) {
  const [pendingDelete, setPendingDelete] = useState<MomentListItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirm = async () => {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      const result = await deleteMoment(pendingDelete.id);
      toast.success('已删除', {
        description: result.retainedPath ? `副本保留在 ${result.retainedPath}` : undefined,
        duration: 8000,
      });
      setPendingDelete(null);
      onChanged();
    } catch (error) {
      toast.error('删除失败', {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (moments.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <Icon icon="ri:chat-smile-3-line" className="size-12 text-muted-foreground" />
        <p className="text-muted-foreground">还没有碎碎念</p>
        <Button onClick={onCompose}>
          <Icon icon="ri:add-line" className="mr-1.5 size-4" />
          写一条
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          共 {moments.length} 条（{moments.filter((m) => m.draft).length} 条草稿）
        </p>
        <Button size="sm" onClick={onCompose}>
          <Icon icon="ri:add-line" className="mr-1.5 size-4" />
          写一条
        </Button>
      </div>

      <ul className="space-y-3">
        {moments.map((moment) => (
          <li key={moment.id} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-muted-foreground text-xs">
                  <time dateTime={moment.date.replace(' ', 'T')}>{moment.date}</time>
                  {moment.draft && (
                    <span className="rounded bg-amber-500/15 px-1.5 py-0.5 font-medium text-amber-600 dark:text-amber-400">
                      草稿
                    </span>
                  )}
                  {moment.updated && <span className="rounded bg-primary/10 px-1.5 py-0.5 font-medium text-primary">已改</span>}
                  <span className="font-mono opacity-60">{moment.id}</span>
                </div>
                <p className="mt-1.5 text-sm leading-relaxed">{moment.preview || '(空)'}</p>
                {moment.tags.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {moment.tags.map((tag) => (
                      <li key={tag} className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs">
                        #{tag}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  title="Edit moment"
                  aria-label={`编辑 ${moment.id}`}
                  onClick={() => onEdit(moment.id)}
                >
                  <Icon icon="ri:edit-line" className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  title="Delete moment"
                  aria-label={`删除 ${moment.id}`}
                  onClick={() => setPendingDelete(moment)}
                  className="text-destructive hover:text-destructive"
                >
                  <Icon icon="ri:delete-bin-line" className="size-4" />
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6">
            <h3 className="font-semibold text-lg">确认删除</h3>
            <p className="mt-2 text-muted-foreground text-sm">
              这条碎碎念不会真正销毁，会移到 <code className="rounded bg-muted px-1 py-0.5 text-xs">backups/deleted/</code>{' '}
              下带时间戳保存。
            </p>
            <p className="mt-2 text-muted-foreground text-xs">
              注意：<code className="rounded bg-muted px-1 py-0.5">backups/</code> 不在 Git 里，
              从版本控制的角度看这仍是一次删除。
            </p>
            <p className="mt-3 rounded bg-muted p-2 font-mono text-xs">{pendingDelete.id}</p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPendingDelete(null)} disabled={isDeleting}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleConfirm} disabled={isDeleting}>
                {isDeleting ? 'Deleting…' : 'Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
