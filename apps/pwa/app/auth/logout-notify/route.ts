import { NextRequest, NextResponse } from "next/server";
import { clearSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ISSUER = process.env.IDENTITY_ISSUER_URL!;

export async function GET(req: NextRequest) {
  const iss = req.nextUrl.searchParams.get("iss");
  if (iss !== ISSUER) {
    return new NextResponse("invalid issuer", { status: 400 });
  }
  await clearSession();
  return new NextResponse("", { status: 200 });
}
