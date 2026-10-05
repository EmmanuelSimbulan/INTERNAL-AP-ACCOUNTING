import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  return NextResponse.redirect(new URL("/prototype", request.url));
}

export const config = {
  matcher: ["/((?!prototype(?:/|$)|api(?:/|$)|_next(?:/|$)|favicon.ico$).*)"],
};
