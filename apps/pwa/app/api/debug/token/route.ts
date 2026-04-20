import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * TEMPORARY diagnostic endpoint. Decodes the JWT currently in the
 * iron-session cookie so we can verify issuer / audience / expiry /
 * scope against what Meridian API's AuthGuard is configured to accept.
 *
 * SAFE TO KEEP IN DEV — only exposes claims already in the token the
 * user holds. DELETE before deploying to any non-local environment;
 * leaking token claims over an HTTP endpoint is not something you
 * want in production, even if the session cookie is httpOnly.
 */
export async function GET() {
  const session = await getSession();
  if (!session.accessToken) {
    return NextResponse.json({ error: "no session" }, { status: 401 });
  }

  const parts = session.accessToken.split(".");
  if (parts.length !== 3) {
    return NextResponse.json(
      {
        error: "access token is not a JWT",
        tokenPreview: `${session.accessToken.slice(0, 20)}...`,
      },
      { status: 200 },
    );
  }

  let header: unknown;
  let payload: Record<string, unknown>;
  try {
    header = JSON.parse(Buffer.from(parts[0], "base64").toString("utf-8"));
    payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf-8"));
  } catch (err) {
    return NextResponse.json(
      { error: "failed to decode JWT", message: (err as Error).message },
      { status: 200 },
    );
  }

  const now = Math.floor(Date.now() / 1000);

  return NextResponse.json({
    header,
    payload,
    computed: {
      now,
      expiresIn: typeof payload.exp === "number" ? payload.exp - now : null,
      expired: typeof payload.exp === "number" ? payload.exp < now : null,
      expectedIssuer: process.env.IDENTITY_ISSUER_URL,
      expectedAudience: process.env.IDENTITY_TOKEN_AUDIENCE,
      audienceMatch:
        typeof payload.aud === "string"
          ? payload.aud === process.env.IDENTITY_TOKEN_AUDIENCE
          : Array.isArray(payload.aud)
            ? payload.aud.includes(process.env.IDENTITY_TOKEN_AUDIENCE ?? "")
            : false,
      issuerMatch: payload.iss === process.env.IDENTITY_ISSUER_URL,
    },
    session: {
      sub: session.sub,
      email: session.email,
      name: session.name,
      personalOrgId: session.personalOrgId,
      personalOrgSlug: session.personalOrgSlug,
      accessTokenExpiresAt: session.accessTokenExpiresAt,
    },
  });
}
