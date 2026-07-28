import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// @monetizekit:middleware-start
/**
 * MonetizeKit-owned middleware helper. Call this from your own middleware
 * handler to enable entitlement-aware routing for the routes covered by
 * MonetizeKit's matcher pattern below. See https://docs.monetizekit.com.
 */
export function monetizekitMiddleware(request: unknown): void {
  // TODO: add MonetizeKit entitlement checks for protected routes here.
}
// @monetizekit:middleware-end

export default function middleware(request: NextRequest) {
  console.log("incoming request", request.nextUrl.pathname);
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/settings/:path*", "/monetizekit-example/:path*"],
};
