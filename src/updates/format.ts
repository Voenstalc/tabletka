export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 МБ';
  const megabytes = bytes / (1024 * 1024);
  if (megabytes >= 100) return `${Math.round(megabytes)} МБ`;
  if (megabytes >= 10) return `${megabytes.toFixed(0)} МБ`;
  return `${megabytes.toFixed(1)} МБ`;
}

/** 0..1 -> 0..100 integer. */
export function progressPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value * 100)));
}
