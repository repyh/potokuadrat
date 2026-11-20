import type { Metadata } from "next";
import { connection } from "next/server";

import { SettingsForm } from "@/features/admin/settings-form";
import { requireAdmin } from "@/server/auth/session";
import { checkDriveStatus } from "@/server/drive/status";
import { getOrganizationService } from "@/server/organizations/runtime";

export const metadata: Metadata = {
  title: "Settings — Potokuadrat",
};

export const instant = false;

export default async function AdminSettingsPage() {
  await connection();
  const session = await requireAdmin();
  const [initialSettings, driveStatus] = await Promise.all([
    getOrganizationService().get(),
    checkDriveStatus(),
  ]);

  return (
    <SettingsForm
      initialSettings={initialSettings}
      driveStatus={driveStatus}
      currentUser={{
        name: session.user.name,
        email: session.user.email,
        role: session.user.role,
      }}
    />
  );
}
