import type { ScanOutcome } from "./types";

/** HTTP status for each scan outcome returned by POST /api/scan/[uuid]. */
export function scanHttpStatus(status: ScanOutcome["status"]): number {
  switch (status) {
    case "ok":
      return 200;
    case "invalid":
      return 404;
    case "already_scanned":
      return 409;
    case "merchant_inactive":
      return 403;
    case "expired":
      return 410;
    case "error":
      return 502;
  }
}
