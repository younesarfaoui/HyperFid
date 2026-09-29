import { NextResponse, type NextRequest } from "next/server";

import { DEVICE_COOKIE, DEVICE_COOKIE_OPTIONS, isValidDeviceId } from "@/lib/device-cookie";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  // Public scan flow: sessionless. Issue the device cookie on the landing GET so
  // the claim Server Action never has to set one (which would re-render the page).
  if (request.nextUrl.pathname.startsWith("/s/")) {
    if (isValidDeviceId(request.cookies.get(DEVICE_COOKIE)?.value)) return NextResponse.next();
    const response = NextResponse.next();
    response.cookies.set(DEVICE_COOKIE, crypto.randomUUID(), DEVICE_COOKIE_OPTIONS);
    return response;
  }

  return updateSession(request);
}

export const config = {
  matcher: ["/", "/login", "/auth/:path*", "/admin/:path*", "/dashboard/:path*", "/s/:path*"],
};
