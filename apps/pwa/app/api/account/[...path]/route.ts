/**
 * Account proxy — forwards `/api/account/[...path]` to the Stageholder Hub
 * with the authenticated user's access token automatically attached.
 *
 * React profile hooks (`useProfile`, `useUpdateProfile`, `useUploadAvatar`)
 * call the product's own origin so the access token never touches the
 * browser and CORS preflight requests are avoided.
 */
import { proxyAccount } from "@stageholder/sdk/nextjs";
import { stageholder } from "@/lib/stageholder";

type RouteContext = { params: Promise<{ path?: string[] }> };

async function makeProxy() {
  const sessionStore = await stageholder.sessionStore();
  return proxyAccount({ config: stageholder.config, sessionStore });
}

export async function GET(req: Request, ctx: RouteContext): Promise<Response> {
  return (await makeProxy()).GET(req, ctx);
}

export async function POST(req: Request, ctx: RouteContext): Promise<Response> {
  return (await makeProxy()).POST(req, ctx);
}

export async function PUT(req: Request, ctx: RouteContext): Promise<Response> {
  return (await makeProxy()).PUT(req, ctx);
}

export async function PATCH(
  req: Request,
  ctx: RouteContext,
): Promise<Response> {
  return (await makeProxy()).PATCH(req, ctx);
}

export async function DELETE(
  req: Request,
  ctx: RouteContext,
): Promise<Response> {
  return (await makeProxy()).DELETE(req, ctx);
}
