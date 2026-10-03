/**
 * Delete Post Dialog
 *
 * Asks for confirmation before removing a post. The post is moved into a
 * retention directory rather than destroyed, so the copy explains where it goes
 * and how to bring it back instead of claiming the action is irreversible.
 */

import { Icon } from '@iconify/react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { PostListItem } from '@/types';

interface DeletePostDialogProps {
  /** The post awaiting deletion, or null when the dialog is closed */
  post: PostListItem | null;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}

export function DeletePostDialog({ post, onCancel, onConfirm }: DeletePostDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirm = async () => {
    setIsDeleting(true);
    try {
      await onConfirm();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog
      open={post !== null}
      onOpenChange={(open) => {
        if (!open && !isDeleting) onCancel();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon icon="ri:alert-line" className="size-5 text-destructive" />
            Delete post
          </DialogTitle>
          <DialogDescription>
            会把 <span className="font-medium text-foreground">{post?.title}</span> 从{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">{post?.id}</code> 移走。 文件不会真正销毁，会保留在{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">backups/deleted/</code> 下，
            带时间戳后缀，随时可以手动移回来。
          </DialogDescription>
        </DialogHeader>
        <p className="text-muted-foreground text-xs">
          注意：<code className="rounded bg-muted px-1 py-0.5">backups/</code> 不在 Git
          里，所以从版本控制的角度看这仍是一次删除。要彻底保住内容，请先提交。
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isDeleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={isDeleting}>
            {isDeleting ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
