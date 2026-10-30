// Resolve root-relative asset URLs (e.g. "/wasm/pymupdf/") against the
// current origin so they keep working inside workers and blob contexts.
export function toAbsoluteUrl<T extends string | undefined>(url: T): T {
  if (!url || !url.startsWith('/') || url.startsWith('//')) return url;
  const origin =
    typeof self !== 'undefined' && self.location ? self.location.origin : '';
  return (origin ? origin + url : url) as T;
}
