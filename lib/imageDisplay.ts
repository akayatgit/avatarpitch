/** Browser-safe display URL (proxy external Replicate URLs through our API). */
export function toDisplayImageUrl(url: string): string {
  if (!url) return url;
  if (url.startsWith('data:') || url.startsWith('/api/proxy-image')) return url;
  if (url.startsWith('https:') || url.startsWith('http:')) {
    return `/api/proxy-image?url=${encodeURIComponent(url)}`;
  }
  return url;
}
