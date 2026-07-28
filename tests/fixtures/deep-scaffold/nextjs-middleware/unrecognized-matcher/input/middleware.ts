import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { protectedRouteMatchers } from "./lib/route-matchers";

export default function middleware(request: NextRequest) {
  console.log("incoming request", request.nextUrl.pathname);
  return NextResponse.next();
}

export const config = {
  matcher: protectedRouteMatchers,
};
