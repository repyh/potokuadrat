import type { Metadata } from "next";

import type { DriveStatusState, OrganizationSettings } from "@/contracts/admin";
import { SettingsMockup } from "@/features/admin/settings-mockup";
import { requireAdmin } from "@/server/auth/session";
import { getOrganizationService } from "@/server/organizations/runtime";

export const metadata: Metadata = {
  title: "Settings — Potokuadrat",
};

export default async function AdminSettingsPage() {
  await requireAdmin();
  const stored = await getOrganizationService().get();

  const initialSettings: OrganizationSettings = stored ?? {
    name: "Potokuadrat",
    title: null,
    logo: null,
    accent: "#d9ef63",
    footerEnabled: true,
    stripMetadata: true,
    updatedAt: new Date().toISOString(),
  };

  const driveState: DriveStatusState = process.env.GOOGLE_DRIVE_KEY_FILE?.trim()
    ? "reachable"
    : "not_configured";

  return <SettingsMockup initialSettings={initialSettings} driveState={driveState} />;
}
