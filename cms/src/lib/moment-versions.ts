/**
 * Moment Version Paths
 *
 * Computes where the previous revision of an edited moment is kept.
 *
 * Editing is expected, unlike deletion, so versions accumulate far faster and
 * live in their own directory (`backups/versions/`) rather than sharing the
 * deleted-post bin. Keeping them apart means the deleted bin still reads as
 * "these were removed by mistake" instead of mixing in every routine edit.
 *
 * The implementation lives in `versions.ts`, shared with blog post versions;
 * this module remains as the moments-facing name.
 */

export { contentVersionPath as momentVersionPath, versionTimestamp } from './versions';
