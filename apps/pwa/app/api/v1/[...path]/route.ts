import { NextRequest, NextResponse } from "next/server";
import { getSession, type ProductSession } from "@/lib/session";
import { refreshAccessToken } from "@/lib/oidc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_URL = process.env.MERIDIAN_API_URL ?? "http://localhost:4000";
const REFRESH_LEEWAY_SECONDS = 60;

async function ensureFreshToken(
  session: Awaited<ReturnType<typeof getSession>>,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (session.accessTokenExpiresAt - REFRESH_LEEWAY_SECONDS > now) {
    return session.accessToken;
  }
  const refreshed = await refreshAccessToken(
    session as unknown as ProductSession,
  );
  session.accessToken = refreshed.accessToken;
  session.refreshToken = refreshed.refreshToken;
  session.accessTokenExpiresAt = refreshed.accessTokenExpiresAt;
  await session.save();
  return session.accessToken;
}

function buildUpstreamUrl(req: NextRequest, pathSegs: string[]): URL {
  const path = pathSegs.map(encodeURIComponent).join("/");
  const url = new URL(`${API_URL}/api/v1/${path}`);
  req.nextUrl.searchParams.forEach((v, k) => url.searchParams.set(k, v));
  return url;
}

function filterRequestHeaders(incoming: Headers): Headers {
  const out = new Headers();
  incoming.forEach((value, key) => {
    const lk = key.toLowerCase();
    if (
      lk === "cookie" ||
      lk === "host" ||
      lk === "content-length" ||
      lk === "connection" ||
      lk === "authorization"
    ) {
      return;
    }
    out.set(key, value);
  });
  return out;
}

async function proxy(
  req: NextRequest,
  method: string,
  pathSegs: string[],
): Promise<NextResponse> {
  const session = await getSession();
  if (!session.sub) {
    return new NextResponse(null, { status: 401 });
  }

  let accessToken: string;
  try {
    accessToken = await ensureFreshToken(session);
  } catch {
    return new NextResponse(
      JSON.stringify({
        code: "session_expired",
        message: "Please sign in again.",
      }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  const headers = filterRequestHeaders(req.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);

  const hasBody = method !== "GET" && method !== "HEAD" && method !== "DELETE";
  const body = hasBody ? await req.arrayBuffer() : undefined;

  const upstream = await fetch(buildUpstreamUrl(req, pathSegs).toString(), {
    method,
    headers,
    body,
  });

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

export async function GET(req: NextRequest, ctx: RouteContext) {
  const { path } = await ctx.params;
  return proxy(req, "GET", path);
}
export async function POST(req: NextRequest, ctx: RouteContext) {
  const { path } = await ctx.params;
  return proxy(req, "POST", path);
}
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const { path } = await ctx.params;
  return proxy(req, "PATCH", path);
}
export async function PUT(req: NextRequest, ctx: RouteContext) {
  const { path } = await ctx.params;
  return proxy(req, "PUT", path);
}
export async function DELETE(req: NextRequest, ctx: RouteContext) {
  const { path } = await ctx.params;
  return proxy(req, "DELETE", path);
}
