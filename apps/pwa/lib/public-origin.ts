/**
 * Cloud Run's standalone Next.js server reports `request.url` as
 * `http://0.0.0.0:3000/...` (the container's bind address). Resolving a
 * relative redirect path against it produces a URL the browser can't follow.
 * Derive the public origin from the forwarded headers Cloud Run actually
 * sets (`X-Forwarded-Proto`, `X-Forwarded-Host`, falling back to `Host`).
 */
export function publicOrigin(request: Request): string {
  const headers = request.headers;
  const proto = headers.get("x-forwarded-proto") ?? "https";
  const host =
    headers.get("x-forwarded-host") ??
    headers.get("host") ??
    new URL(request.url).host;
  return `${proto}://${host}`;
}
