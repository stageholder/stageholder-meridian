/**
 * Meridian API proxy — forwards `/api/v1/[...path]` to the Meridian API with
 * the authenticated user's access token automatically attached.
 *
 * Uses the SDK's `fetchWithAuth` helper which proactively refreshes the token
 * when within 60 s of expiry and retries once on 401 before throwing
 * `SessionExpiredError`.
 *
 * 402 responses (over-cap writes) are forwarded as-is with their body intact
 * so the client-side interceptor in `lib/api-client.ts` can read
 * `{ code, feature, limit, current }` and dispatch the `meridian:paywall`
 * custom event.
 */
import { NextRequest, NextResponse } from "next/server";
import { fetchWithAuth } from "@stageholder/sdk/nextjs";
import { SessionExpiredError } from "@stageholder/sdk/core";
import { stageholder } from "@/lib/stageholder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_URL = process.env.MERIDIAN_API_URL ?? "http://localhost:4000";

function buildUpstreamUrl(req: NextRequest, pathSegs: string[]): string {
  const path = pathSegs.map(encodeURIComponent).join("/");
  const url = new URL(`${API_URL}/api/v1/${path}`);
  req.nextUrl.searchParams.forEach((v, k) => url.searchParams.set(k, v));
  return url.toString();
}

function filterRequestHeaders(incoming: Headers): Headers {
  const blocked = new Set([
    "cookie",
    "host",
    "content-length",
    "connection",
    "authorization",
  ]);
  const out = new Headers();
  incoming.forEach((value, key) => {
    if (!blocked.has(key.toLowerCase())) out.set(key, value);
  });
  return out;
}

async function proxy(
  req: NextRequest,
  method: string,
  pathSegs: string[],
): Promise<NextResponse> {
  const sessionStore = await stageholder.sessionStore();
  const session = await sessionStore.get();
  if (!session) {
    return new NextResponse(null, { status: 401 });
  }

  const hasBody = method !== "GET" && method !== "HEAD" && method !== "DELETE";
  const init: RequestInit = {
    method,
    headers: filterRequestHeaders(req.headers),
    body: hasBody ? await req.arrayBuffer() : undefined,
  };

  let upstream: Response;
  try {
    upstream = await fetchWithAuth(buildUpstreamUrl(req, pathSegs), {
      config: stageholder.config,
      sessionStore,
      init,
    });
  } catch (err) {
    if (err instanceof SessionExpiredError) {
      return new NextResponse(
        JSON.stringify({
          code: "session_expired",
          message: "Please sign in again.",
        }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }
    throw err;
  }

  // Strip hop-by-hop headers before forwarding the upstream response.
  const responseHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    const lk = key.toLowerCase();
    if (
      lk === "content-encoding" ||
      lk === "transfer-encoding" ||
      lk === "connection"
    ) {
      return;
    }
    responseHeaders.set(key, value);
  });

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(
  req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse> {
  const { path } = await ctx.params;
  return proxy(req, "GET", path);
}
export async function POST(
  req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse> {
  const { path } = await ctx.params;
  return proxy(req, "POST", path);
}
export async function PATCH(
  req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse> {
  const { path } = await ctx.params;
  return proxy(req, "PATCH", path);
}
export async function PUT(
  req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse> {
  const { path } = await ctx.params;
  return proxy(req, "PUT", path);
}
export async function DELETE(
  req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse> {
  const { path } = await ctx.params;
  return proxy(req, "DELETE", path);
}
