import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export default function middleware(request: NextRequest) {
  console.log("incoming request", request.nextUrl.pathname);
  return NextResponse.next();
}
