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
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { createMoment } from '@/lib/api';
import { cn } from '@/lib/utils';

interface MomentComposerProps {
  /** Whether the composer is open */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful write, so the list can refresh */
  onSuccess: () => void;
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

export function MomentComposer({ open, onOpenChange, onSuccess }: MomentComposerProps) {
  const [body, setBody] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const tags = parseTags(tagInput);
  const canSubmit = body.trim().length > 0 && !isSaving;

  const reset = useCallback(() => {
    setBody('');
    setTagInput('');
  }, []);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSaving(true);
    try {
      const result = await createMoment({ body: body.trim(), tags: tags.length > 0 ? tags : undefined });
      toast.success('碎碎念已写入', { description: result.momentId, duration: 6000 });
      reset();
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast.error('写入失败', {
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
            <Icon icon="ri:chat-smile-3-line" className="size-5" />
            写一条碎碎念
          </DialogTitle>
          <DialogDescription>没有标题——正文就是内容。支持 Markdown，正文里的换行会原样保留。</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <textarea
            aria-label="碎碎念正文"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="随便写点什么…"
            rows={8}
            // eslint-disable-next-line jsx-a11y/no-autofocus -- the dialog exists to be typed in
            autoFocus
            className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring"
          />

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
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {isSaving ? 'Saving…' : 'Publish'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
