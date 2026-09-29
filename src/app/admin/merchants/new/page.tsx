import type { Metadata } from "next";

import { MerchantForm } from "@/components/admin/merchant-form";
import { PageHeader } from "@/components/shell/app-shell";
import { Card, CardBody } from "@/components/ui/card";
import { requireSuperAdmin } from "@/lib/auth/guards";

import { createMerchant } from "../../actions";

export const metadata: Metadata = { title: "Nouveau commerçant" };

export default async function NewMerchantPage() {
  await requireSuperAdmin();
  return (
    <>
      <PageHeader title="Nouveau commerçant" description="Créez le tenant, puis générez ses QR codes et invitez son gérant." />
      <Card className="max-w-3xl">
        <CardBody>
          <MerchantForm action={createMerchant} />
        </CardBody>
      </Card>
    </>
  );
}
