import type { Metadata } from "next";
import { connection } from "next/server";

import { DriveView } from "@/features/admin/drive-view";
import { requireAdmin } from "@/server/auth/session";
import { getDriveOverview } from "@/server/drive/overview";

export const metadata: Metadata = {
  title: "Drive — Potokuadrat",
};

export const instant = false;

export default async function AdminDrivePage() {
  await connection();
  await requireAdmin();
  const overview = await getDriveOverview();

  return (
    <DriveView
      status={overview.status}
      serviceAccountEmail={overview.serviceAccountEmail}
      folders={overview.folders}
      foldersError={overview.foldersError}
      limits={overview.limits}
      now={new Date().getTime()}
    />
  );
}
