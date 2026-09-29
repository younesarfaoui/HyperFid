/**
 * Live smoke test for the WalletWallet provider: creates one loyalty pass,
 * then updates its stamp count, using the same code path as production.
 *
 *   npm run wallet:smoke
 *
 * Reads WALLETWALLET_API_KEY (and optional WALLETWALLET_API_URL) from
 * .env.local. Uses 2 passes of your WalletWallet quota. Never prints the key.
 */
import { randomUUID } from "node:crypto";

import type { LoyaltyPassInput } from "../src/lib/wallet/types";
import { WalletWalletProvider } from "../src/lib/wallet/walletwallet";

async function main() {
  const apiKey = process.env.WALLETWALLET_API_KEY;
  if (!apiKey) {
    console.error("Missing WALLETWALLET_API_KEY (set it in .env.local)");
    process.exit(1);
  }

  const provider = new WalletWalletProvider(apiKey, process.env.WALLETWALLET_API_URL || undefined);
  const input: LoyaltyPassInput = {
    walletId: randomUUID(),
    merchantName: "Mandy Coffee Shop",
    rewardDescription: "1 Café Express gratuit",
    brandColor: "#6F4E37",
    currentStamps: 1,
    stampsGoal: 10,
    rewardsRedeemed: 0,
  };

  console.log("→ Creating a test pass…");
  const pass = await provider.createPass(input);
  console.log(`✓ serialNumber   ${pass.serialNumber}`);
  console.log(`  shareUrl       ${pass.shareUrl ?? "(missing)"}`);
  console.log(`  googleSaveUrl  ${pass.googleSaveUrl ?? "(missing)"}`);

  console.log("→ Updating it to 2 stamps…");
  await provider.updatePass(pass.serialNumber, { ...input, currentStamps: 2 });
  console.log("✓ Update accepted. Open the shareUrl on your phone to add the pass and check the stamp count.");

  if (!pass.shareUrl || !pass.googleSaveUrl) {
    console.error("✗ The create response is missing shareUrl or googleSaveUrl — check the field mapping in walletwallet.ts");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("✗", error instanceof Error ? error.message : error);
  process.exit(1);
});
