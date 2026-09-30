import { NextResponse, type NextRequest } from "next/server";

import { getOrCreateDeviceId, hashDevice } from "@/lib/device";
import { isSameOrigin } from "@/lib/http";
import { claimScan } from "@/lib/scan/claim";
import { scanHttpStatus } from "@/lib/scan/http";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * POST /api/scan/[uuid] — claims a single-use QR code for this device and
 * returns the outcome plus the Wallet pass URL the page redirects to.
 * Anonymous by design (no login); device identity is the httpOnly
 * `hf_device` cookie, stored only as an HMAC.
 */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/scan/[uuid]">) {
  // A cross-site page must not be able to claim codes into a visitor's device.
  if (!isSameOrigin(request)) {
    return NextResponse.json({ status: "forbidden" }, { status: 403, headers: NO_STORE });
  }

  const { uuid } = await ctx.params;
  const deviceId = await getOrCreateDeviceId();
  const outcome = await claimScan(uuid, hashDevice(deviceId));

  return NextResponse.json(outcome, { status: scanHttpStatus(outcome.status), headers: NO_STORE });
}

/** Scanning has side effects, so GET (link previews, prefetchers, crawlers) never claims. */
export function GET() {
  return NextResponse.json(
    { status: "method_not_allowed" },
    { status: 405, headers: { ...NO_STORE, Allow: "POST" } },
  );
}
