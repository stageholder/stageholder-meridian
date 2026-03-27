import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const STATIC_ROUTES = new Set([
  "login",
  "register",
  "workspaces",
  "auth",
  "_next",
  "api",
]);
const STATIC_FILES = new Set(["favicon.ico", "manifest.json", "sw.js"]);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isLoggedIn = request.cookies.get("logged_in")?.value === "1";

  const fileName = pathname.split("/").pop() || "";
  if (
    STATIC_FILES.has(fileName) ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/icons/") ||
    pathname.startsWith("/favicon/") ||
    pathname.startsWith("/logo/")
  ) {
    return NextResponse.next();
  }

  const firstSegment = pathname.split("/")[1] || "";

  if (pathname === "/") {
    return isLoggedIn
      ? NextResponse.redirect(new URL("/workspaces", request.url))
      : NextResponse.redirect(new URL("/login", request.url));
  }

  if (firstSegment === "login" || firstSegment === "register") {
    if (isLoggedIn)
      return NextResponse.redirect(new URL("/workspaces", request.url));
    return NextResponse.next();
  }

  if (STATIC_ROUTES.has(firstSegment)) {
    if (!isLoggedIn && firstSegment === "workspaces") {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next();
  }

  if (!isLoggedIn) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js).*)",
  ],
};
