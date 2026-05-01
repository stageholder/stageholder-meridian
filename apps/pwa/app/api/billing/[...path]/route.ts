/**
 * Billing proxy — forwards `/api/billing/[...path]` to the Stageholder Hub
 * with the authenticated user's access token automatically attached.
 *
 * React billing hooks (`usePricing`, `useStartCheckout`, `useInvoices`,
 * `useBillingPortal`) call the product's own origin so the access token
 * never touches the browser and CORS preflight requests are avoided.
 *
 * The session store is constructed per-request by the `stageholder` singleton,
 * which binds it to the current Next.js async cookie context automatically.
 */
import { proxyBilling } from "@stageholder/sdk/nextjs";
import { stageholder } from "@/lib/stageholder";

type RouteContext = { params: Promise<{ path?: string[] }> };

async function makeProxy() {
  const sessionStore = await stageholder.sessionStore();
  return proxyBilling({ config: stageholder.config, sessionStore });
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
