/**
 * Unsaved Changes Dialog
 *
 * Shown when the editor is closed while there are unsaved edits.
 *
 * Replaces a `window.confirm` call, which was the only native dialog left in
 * the CMS. That call had two problems beyond looking out of place: it offers
 * only "OK" and "Cancel", so there is no way to save on the way out, and it is
 * a blocking browser dialog that some embedded and mobile contexts suppress —
 * in which case closing the editor appears to do nothing at all.
 */

import { Icon } from '@iconify/react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface UnsavedChangesDialogProps {
  open: boolean;
  /** Whether a save is already in flight, so the buttons can be held */
  isSaving: boolean;
  onCancel: () => void;
  /** Discard the edits and close */
  onDiscard: () => void;
  /** Save, then close — the option a native confirm could not offer */
  onSaveAndClose: () => void;
}

export function UnsavedChangesDialog({ open, isSaving, onCancel, onDiscard, onSaveAndClose }: UnsavedChangesDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !isSaving) onCancel();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon icon="ri:alert-line" className="size-5 text-amber-600 dark:text-amber-500" />
            有未保存的改动
          </DialogTitle>
          <DialogDescription>直接关闭会丢弃这些改动，且无法恢复。</DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isSaving}>
            取消
          </Button>
          <Button variant="destructive" onClick={onDiscard} disabled={isSaving}>
            不保存并关闭
          </Button>
          <Button onClick={onSaveAndClose} disabled={isSaving}>
            {isSaving ? (
              <>
                <Icon icon="ri:loader-4-line" className="mr-1.5 size-4 animate-spin" />
                保存中…
              </>
            ) : (
              '保存并关闭'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
