import type { Metadata } from "next";

import { SettingsForm } from "@/features/admin/settings-form";
import { requireAdmin } from "@/server/auth/session";
import { checkDriveStatus } from "@/server/drive/status";
import { getOrganizationService } from "@/server/organizations/runtime";

export const metadata: Metadata = {
  title: "Settings — Potokuadrat",
};

export default async function AdminSettingsPage() {
  await requireAdmin();
  const [initialSettings, driveStatus] = await Promise.all([
    getOrganizationService().get(),
    checkDriveStatus(),
  ]);

  return <SettingsForm initialSettings={initialSettings} driveStatus={driveStatus} />;
}
