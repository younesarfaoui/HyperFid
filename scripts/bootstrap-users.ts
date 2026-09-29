/**
 * Creates the first super admin and the Mandy Coffee Shop merchant admin via
 * the Auth admin API. Role and merchant are passed in app_metadata, which the
 * `on_auth_user_created` trigger turns into a `profiles` row.
 *
 *   npm run bootstrap:users
 *
 * Reads .env.local. Idempotent: existing users are left untouched.
 */
import { createClient } from "@supabase/supabase-js";

const MANDY_MERCHANT_ID = "6d9a3c52-1f0e-4b7a-9c3d-2a5e8f1b4c70";

function env(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name} (set it in .env.local)`);
    process.exit(1);
  }
  return value;
}

const supabase = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function ensureUser(email: string, password: string, appMetadata: Record<string, string>) {
  if (password.length < 10) {
    throw new Error(`Password for ${email} must be at least 10 characters`);
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: appMetadata,
  });

  if (error) {
    if (/already (been )?registered|already exists/i.test(error.message)) {
      console.log(`• ${email} already exists — skipped`);
      return;
    }
    throw error;
  }

  console.log(`✓ created ${email} (${appMetadata.role})  id=${data.user.id}`);
}

async function main() {
  const { data: mandy, error } = await supabase
    .from("merchants")
    .select("id")
    .eq("id", MANDY_MERCHANT_ID)
    .maybeSingle();

  if (error) throw error;
  if (!mandy) {
    throw new Error("Mandy Coffee Shop not found — run the migration and supabase/seed.sql first");
  }

  await ensureUser(env("BOOTSTRAP_SUPER_ADMIN_EMAIL"), env("BOOTSTRAP_SUPER_ADMIN_PASSWORD"), {
    role: "super_admin",
  });

  await ensureUser(env("BOOTSTRAP_MERCHANT_EMAIL"), env("BOOTSTRAP_MERCHANT_PASSWORD"), {
    role: "merchant_admin",
    merchant_id: MANDY_MERCHANT_ID,
  });
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
