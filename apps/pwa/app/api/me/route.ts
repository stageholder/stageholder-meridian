import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface MeResponse {
  sub: string;
  email?: string;
  name?: string;
  personalOrgId: string | null;
  personalOrgSlug: string | null;
}

export async function GET() {
  const session = await getSession();
  if (!session.sub) {
    return new NextResponse(null, { status: 401 });
  }
  const body: MeResponse = {
    sub: session.sub,
    email: session.email,
    name: session.name,
    personalOrgId: session.personalOrgId ?? null,
    personalOrgSlug: session.personalOrgSlug ?? null,
  };
  return NextResponse.json(body);
}
