/**
 * Moment Composer
 *
 * The writing surface for the moments ("碎碎念") feed.
 *
 * Deliberately a plain textarea, not the BlockNote editor used for posts. The
 * point of a moment is to be quick to write, and a rich-text editor's
 * round-trip (parsing markdown in, re-serializing it out) is both slower to load
 * and a source of lossy edits — the post editor had exactly that class of bug.
 * A textarea cannot corrupt what it does not parse.
 */

import { Icon } from '@iconify/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { createMoment, readMoment, updateMoment, uploadImage } from '@/lib/api';
import { cn } from '@/lib/utils';

interface MomentComposerProps {
  /** Whether the composer is open */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful write, so the list can refresh */
  onSuccess: () => void;
  /**
   * Id of the moment being edited, or null to write a new one.
   *
   * One component serves both modes because the two differ only in where the
   * fields come from and which endpoint they go to; splitting them would
   * duplicate the textarea, tag parsing, and length counter.
   */
  editingMomentId?: string | null;
}

/** Parse a comma- or space-separated tag string into a de-duplicated list. */
function parseTags(input: string): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const part of input.split(/[,，\s]+/)) {
    const tag = part.trim().replace(/^#/, '');
    if (tag && !seen.has(tag)) {
      seen.add(tag);
      tags.push(tag);
    }
  }
  return tags;
}

export function MomentComposer({ open, onOpenChange, onSuccess, editingMomentId = null }: MomentComposerProps) {
  const [body, setBody] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEditing = editingMomentId !== null;
  const tags = parseTags(tagInput);
  const canSubmit = body.trim().length > 0 && !isSaving && !isLoading;

  const reset = useCallback(() => {
    setBody('');
    setTagInput('');
    setLoadError(null);
  }, []);

  /**
   * Insert text where the caret currently sits, rather than appending.
   *
   * A promise is returned so callers can await the state flush before deciding
   * anything that depends on the new caret position.
   */
  const insertAtCursor = useCallback((text: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      // No ref yet (the dialog is still mounting): appending is the only thing
      // that cannot lose the text, and this path is not reachable by typing.
      setBody((current) => `${current}${text}`);
      return;
    }

    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? start;
    // Surround with newlines when the insertion point is mid-paragraph, so an
    // image cannot end up glued to the end of a sentence.
    const before = textarea.value.slice(0, start);
    const needsLeadingBreak = before.length > 0 && !before.endsWith('\n');
    const snippet = `${needsLeadingBreak ? '\n\n' : ''}${text}\n`;

    setBody(`${before}${snippet}${textarea.value.slice(end)}`);

    // Restore the caret after React has written the new value, otherwise the
    // browser resets it to the end and the next keystroke lands in the wrong
    // place.
    const nextCaret = start + snippet.length;
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(nextCaret, nextCaret);
    });
  }, []);

  /** Upload one image and insert the resulting Markdown reference. */
  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('image/')) {
        toast.error('只能插入图片', { description: file.type || file.name });
        return;
      }

      setIsUploading(true);
      try {
        const result = await uploadImage(file, '');
        insertAtCursor(result.markdown);
        toast.success('图片已插入', { description: result.fileName, duration: 5000 });
      } catch (error) {
        toast.error('上传失败', { description: error instanceof Error ? error.message : String(error) });
      } finally {
        setIsUploading(false);
      }
    },
    [insertAtCursor],
  );

  // Load the existing moment when opening in edit mode. Keyed on the id as well
  // as `open`, so switching straight from one moment to another refetches
  // instead of showing the previous one's text.
  useEffect(() => {
    if (!open || !editingMomentId) return;

    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);

    readMoment(editingMomentId)
      .then((moment) => {
        if (cancelled) return;
        setBody(moment.body);
        setTagInput(moment.tags.join(' '));
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, editingMomentId]);

  // Clear the fields when the dialog closes, so reopening never shows a stale
  // draft from the previous session.
  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSaving(true);
    try {
      if (editingMomentId) {
        const result = await updateMoment({
          momentId: editingMomentId,
          body: body.trim(),
          tags: tags.length > 0 ? tags : undefined,
        });
        toast.success('已保存', {
          description: result.versionPath ? `旧版保留在 ${result.versionPath}` : undefined,
          duration: 8000,
        });
      } else {
        const result = await createMoment({ body: body.trim(), tags: tags.length > 0 ? tags : undefined });
        toast.success('碎碎念已写入', { description: result.momentId, duration: 6000 });
      }
      reset();
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast.error(isEditing ? '保存失败' : '写入失败', {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !isSaving) onOpenChange(false);
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon icon={isEditing ? 'ri:edit-line' : 'ri:chat-smile-3-line'} className="size-5" />
            {isEditing ? '编辑碎碎念' : '写一条碎碎念'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? '发布日期不变，只会更新「最后修改」。保存前旧版会留一份到 backups/versions/。正文支持 Markdown、表情和图片。'
              : '没有标题——正文就是内容。支持 Markdown，表情可以直接打，图片可以选、粘、拖。'}
          </DialogDescription>
        </DialogHeader>

        {loadError && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
            <Icon icon="ri:error-warning-line" className="mt-0.5 size-4 shrink-0 text-destructive" />
            <span>读取失败：{loadError}</span>
          </div>
        )}

        <div className="space-y-3">
          <textarea
            ref={textareaRef}
            aria-label="碎碎念正文"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            // Editing disables the field until the existing text has loaded, so
            // typing cannot race the fetch and get overwritten by it.
            disabled={isLoading}
            placeholder={isLoading ? '读取中…' : '随便写点什么…'}
            rows={8}
            // eslint-disable-next-line jsx-a11y/no-autofocus -- the dialog exists to be typed in
            autoFocus
            className={cn(
              'w-full resize-y rounded-lg border bg-background px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60',
              isDragging ? 'border-primary ring-2 ring-primary' : 'border-input',
            )}
            // Pasting a screenshot straight from the clipboard is the fastest
            // path in, and the browser hands over a File blob we can post
            // as-is. Falls through to the default when the clipboard holds text.
            onPaste={(e) => {
              const file = Array.from(e.clipboardData?.files ?? []).find((f) => f.type.startsWith('image/'));
              if (!file) return;
              e.preventDefault();
              void handleFile(file);
            }}
            onDragOver={(e) => {
              // Only claim the drop when files are actually being dragged, so
              // dragging selected text still behaves normally.
              if (!e.dataTransfer?.types.includes('Files')) return;
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              if (!e.dataTransfer?.types.includes('Files')) return;
              e.preventDefault();
              setIsDragging(false);
              const file = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith('image/'));
              if (file) void handleFile(file);
            }}
          />

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isLoading || isUploading}
              onClick={() => fileInputRef.current?.click()}
            >
              <Icon
                icon={isUploading ? 'ri:loader-4-line' : 'ri:image-add-line'}
                className={cn('size-4', isUploading && 'animate-spin')}
              />
              {isUploading ? '上传中…' : '插入图片'}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp,image/avif"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                // Reset first: picking the same file twice in a row fires no
                // change event unless the input is cleared.
                e.target.value = '';
                if (file) void handleFile(file);
              }}
            />
            <span className="text-muted-foreground text-xs">也可以直接粘贴截图，或把图片拖进来</span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1">
              <Icon
                icon="ri:price-tag-3-line"
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="text"
                aria-label="标签"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="标签，用空格或逗号分隔（可留空）"
                className="w-full rounded-lg border border-input bg-background py-2 pr-3 pl-9 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <span className={cn('text-xs', body.length > 0 ? 'text-muted-foreground' : 'text-transparent')}>
              {body.trim().length} 字
            </span>
          </div>

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || Boolean(loadError)}>
            {isSaving ? 'Saving…' : isEditing ? 'Save' : 'Publish'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
