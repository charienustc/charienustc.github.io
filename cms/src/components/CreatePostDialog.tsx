/**
 * Create Post Dialog
 *
 * Dialog for creating new blog posts with title, categories, tags, and draft status.
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { Icon } from '@iconify/react';
import { useCallback, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { type CustomCategory, useCustomCategories } from '@/hooks/useCustomCategories';
import { generateCategorySlug } from '@/lib/category';
import { mergeCategoryOptions, previewCategoryPath, resolveCategory } from '@/lib/category-preview';
import { type CreatePostFormData, createPostSchema } from '@/lib/schemas';
import { cn } from '@/lib/utils';

interface CreatePostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Category names seen in existing posts. Merged with `categoryMap` for the chips. */
  existingCategories: string[];
  /** Configured `categoryMap` from `config/site.yaml`. Determines reuse vs. creation. */
  categoryMap: Record<string, string>;
  onSuccess: (postId: string) => void;
}

/**
 * Custom category chip with editable slug
 */
function CustomCategoryChip({
  category,
  onRemove,
  onSlugChange,
}: {
  category: CustomCategory;
  onRemove: () => void;
  onSlugChange: (slug: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <div className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-sm">
      <span className="font-medium text-primary">{category.name}</span>
      {isEditing ? (
        <input
          aria-label={`Slug for ${category.name}`}
          type="text"
          value={category.slug}
          onChange={(e) => onSlugChange(e.target.value)}
          onBlur={() => setIsEditing(false)}
          onKeyDown={(e) => e.key === 'Enter' && setIsEditing(false)}
          className="ml-1 w-24 rounded border border-border bg-background px-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
        />
      ) : (
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="ml-1 text-muted-foreground text-xs hover:text-foreground"
          title="Edit slug"
        >
          ({category.slug})
        </button>
      )}
      <button
        type="button"
        onClick={onRemove}
        className="ml-1 text-muted-foreground hover:text-destructive"
        aria-label={`Remove ${category.name}`}
      >
        <Icon icon="ri:close-line" className="size-3.5" />
      </button>
    </div>
  );
}

export function CreatePostDialog({ open, onOpenChange, existingCategories, categoryMap, onSuccess }: CreatePostDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const selectedCategorySet = useMemo(() => new Set(selectedCategories), [selectedCategories]);
  const [newCategoryInput, setNewCategoryInput] = useState('');

  const {
    customCategories,
    addCustomCategory,
    removeCustomCategory,
    updateCategorySlug,
    resetCustomCategories,
    getCategoryMappings,
  } = useCustomCategories();

  /**
   * Chips offered for one-click selection.
   *
   * Configured categories lead, because those are the ones with a real URL and
   * page already; names only seen in past posts follow so they are still one
   * click away. Without the configured half this list goes empty the moment the
   * blog has no posts — which is exactly when a writer most needs to know which
   * category names are valid.
   */
  const categoryOptions = useMemo(
    () => mergeCategoryOptions(categoryMap, existingCategories),
    [categoryMap, existingCategories],
  );

  /**
   * What the typed name would do if the post were created right now.
   *
   * Shown live so a typo is visible before submitting: an unmatched name is not
   * an error, it silently creates a category *and* rewrites `config/site.yaml`.
   */
  const pendingCategory = useMemo(
    () => resolveCategory(newCategoryInput, categoryMap, customCategories),
    [newCategoryInput, categoryMap, customCategories],
  );

  /** Where the post file will land, mirroring the server's path generation. */
  const categoryPath = useMemo(
    () => previewCategoryPath(selectedCategories, categoryMap, customCategories, generateCategorySlug),
    [selectedCategories, categoryMap, customCategories],
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreatePostFormData>({
    resolver: zodResolver(createPostSchema),
    defaultValues: {
      title: '',
      categories: [],
      tags: '',
      draft: true,
    },
  });

  const handleClose = useCallback(() => {
    reset();
    setSelectedCategories([]);
    setNewCategoryInput('');
    resetCustomCategories();
    onOpenChange(false);
  }, [reset, resetCustomCategories, onOpenChange]);

  const toggleCategory = useCallback((category: string) => {
    setSelectedCategories((prev) => (prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]));
  }, []);

  const handleAddCustomCategory = useCallback(() => {
    const trimmed = newCategoryInput.trim();
    if (!trimmed) return;

    // Add to selected and custom categories
    addCustomCategory(trimmed);
    setSelectedCategories((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
    setNewCategoryInput('');
  }, [newCategoryInput, addCustomCategory]);

  const handleRemoveCustomCategory = useCallback(
    (name: string) => {
      removeCustomCategory(name);
      setSelectedCategories((prev) => prev.filter((c) => c !== name));
    },
    [removeCustomCategory],
  );

  const onSubmit = async (data: CreatePostFormData) => {
    setIsSubmitting(true);
    try {
      // Parse tags from comma-separated string
      const tags = data.tags
        ? data.tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
        : undefined;

      // Get custom category mappings
      const categoryMappings = getCategoryMappings();

      const response = await fetch('/api/cms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: data.title,
          categories: selectedCategories.length > 0 ? selectedCategories : undefined,
          tags,
          draft: data.draft,
          categoryMappings: Object.keys(categoryMappings).length > 0 ? categoryMappings : undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to create post');
      }

      const result = await response.json();
      handleClose();
      onSuccess(result.postId);
    } catch (error) {
      console.error('Failed to create post:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create post');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create New Post</DialogTitle>
          <DialogDescription>Fill in the details below to create a new blog post.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <label htmlFor="title" className="font-medium text-sm">
              Title <span className="text-destructive">*</span>
            </label>
            <input
              id="title"
              type="text"
              {...register('title')}
              placeholder="Enter post title..."
              className={cn(
                'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm',
                'focus:outline-none focus:ring-2 focus:ring-ring',
                errors.title && 'border-destructive',
              )}
            />
            {errors.title && <p className="text-destructive text-xs">{errors.title.message}</p>}
          </div>

          {/* Categories */}
          <div className="space-y-2">
            <span className="font-medium text-sm">Categories</span>

            {/* Selected categories display */}
            {selectedCategories.length > 0 && (
              <div className="flex flex-wrap gap-2 rounded-lg border border-border bg-muted/30 p-2">
                {selectedCategories.map((cat) => {
                  const customCat = customCategories.find((c) => c.name === cat);
                  if (customCat) {
                    return (
                      <CustomCategoryChip
                        key={cat}
                        category={customCat}
                        onRemove={() => handleRemoveCustomCategory(cat)}
                        onSlugChange={(slug) => updateCategorySlug(cat, slug)}
                      />
                    );
                  }
                  return (
                    <span key={cat} className="flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-sm">
                      {cat}
                      <button
                        type="button"
                        onClick={() => toggleCategory(cat)}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label={`Remove ${cat}`}
                      >
                        <Icon icon="ri:close-line" className="size-3.5" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            {/* Existing categories. Configured ones are marked, so it is clear
                at a glance which names already have a page behind them. */}
            {categoryOptions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {categoryOptions.map((cat) => {
                  const resolution = resolveCategory(cat, categoryMap, customCategories);
                  const isConfigured = resolution?.kind === 'existing';
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => toggleCategory(cat)}
                      title={isConfigured ? `已有分类 · ${resolution.slug}` : '文章里用过，但 config 里还没有映射'}
                      className={cn(
                        'flex items-center gap-1.5 rounded-full px-3 py-1 text-sm transition-colors',
                        selectedCategorySet.has(cat) ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80',
                      )}
                    >
                      {cat}
                      {isConfigured && (
                        <Icon
                          icon="ri:price-tag-3-fill"
                          className={cn(
                            'size-3',
                            selectedCategorySet.has(cat) ? 'text-primary-foreground/70' : 'text-muted-foreground',
                          )}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Custom category input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newCategoryInput}
                onChange={(e) => setNewCategoryInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCustomCategory();
                  }
                }}
                placeholder="Add custom category..."
                className={cn(
                  'flex-1 rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring',
                  pendingCategory?.kind === 'new' ? 'border-amber-500/60' : 'border-input',
                )}
              />
              <Button type="button" variant="outline" size="sm" onClick={handleAddCustomCategory}>
                <Icon icon="ri:add-line" className="size-4" />
              </Button>
            </div>

            {/* Live resolution of the typed name. Only a hint — creating a new
                category is a legitimate thing to do, so it never blocks submit. */}
            {pendingCategory && (
              <p
                className={cn(
                  'flex items-start gap-1.5 text-xs',
                  pendingCategory.kind === 'new' ? 'text-amber-600 dark:text-amber-500' : 'text-muted-foreground',
                )}
              >
                <Icon
                  icon={pendingCategory.kind === 'new' ? 'ri:add-circle-line' : 'ri:check-line'}
                  className="mt-0.5 size-3.5 shrink-0"
                />
                {pendingCategory.kind === 'new' ? (
                  <span>
                    会新建分类「{pendingCategory.name}」（
                    <code className="rounded bg-muted px-1 py-0.5 text-foreground">
                      {generateCategorySlug(pendingCategory.name) || '无法生成 slug'}
                    </code>
                    ），并把这条映射写进 config/site.yaml。加进来之后点 slug 可以改。
                  </span>
                ) : (
                  <span>
                    已有分类，会归到{' '}
                    <code className="rounded bg-muted px-1 py-0.5 text-foreground">{pendingCategory.slug}</code>
                  </span>
                )}
              </p>
            )}

            {/* Where the file lands. Mirrors the server's path generation, so a
                surprise here means a surprise on disk. */}
            {categoryPath.resolutions.length > 0 && (
              <p className="flex items-center gap-1.5 text-muted-foreground text-xs">
                <Icon icon="ri:folder-line" className="size-3.5 shrink-0" />
                <span className="truncate">
                  src/content/blog/{categoryPath.segments.join('/')}/<span className="text-foreground">你的标题.md</span>
                </span>
              </p>
            )}
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <label htmlFor="tags" className="font-medium text-sm">
              Tags
            </label>
            <input
              id="tags"
              type="text"
              {...register('tags')}
              placeholder="tag1, tag2, tag3..."
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="text-muted-foreground text-xs">Separate tags with commas</p>
          </div>

          {/* Draft checkbox */}
          <div className="flex items-center gap-2">
            <input id="draft" type="checkbox" {...register('draft')} className="size-4 rounded border-input" />
            <label htmlFor="draft" className="text-sm">
              Save as draft
            </label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Icon icon="ri:loader-4-line" className="mr-1.5 size-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Icon icon="ri:add-line" className="mr-1.5 size-4" />
                  Create Post
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
