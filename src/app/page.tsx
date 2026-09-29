import { redirect } from "next/navigation";

import { getSessionProfile, homePathFor } from "@/lib/auth/guards";

export default async function Home() {
  const session = await getSessionProfile();
  redirect(session ? homePathFor(session.profile) : "/login");
}
