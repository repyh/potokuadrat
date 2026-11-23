import type { Metadata } from "next";
import { connection } from "next/server";

import { SharesView } from "@/features/admin/shares-view";
import { parseShareIndexParams, toShareIndexQuery } from "@/features/admin/share-index-query";
import { requireAdmin } from "@/server/auth/session";
import { getShareAdminService } from "@/server/shares/runtime";

export const metadata: Metadata = {
  title: "Shares — Potokuadrat",
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminSharesPage({ searchParams }: PageProps) {
  await connection();
  const session = await requireAdmin();

  const state = parseShareIndexParams(await searchParams);
  const page = await getShareAdminService().listAll(session.user.id, toShareIndexQuery(state));

  return <SharesView page={page} state={state} now={new Date().getTime()} />;
}
