/**
 * Delete Post Dialog
 *
 * Asks for confirmation before permanently removing a post file.
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
            This permanently deletes <span className="font-medium text-foreground">{post?.title}</span> from{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">{post?.id}</code>. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
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
