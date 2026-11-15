"use server";

import type {
  DriveStatus,
  OrganizationSettingsInput,
  OrganizationSettingsResponse,
} from "@/contracts/admin";
import type { ActionResult } from "@/contracts/actions";
import { getAdminSession } from "@/server/auth/api";
import { checkDriveStatus } from "@/server/drive/status";
import { getOrganizationService } from "@/server/organizations/runtime";
import { organizationSettingsSchema } from "@/server/organizations/validation";

const UNAUTHORIZED: ActionResult<never> = {
  ok: false,
  error: "Unauthorized.",
  code: "unauthorized",
};

async function adminUserId(): Promise<string | null> {
  const session = await getAdminSession();
  return session?.user.id ?? null;
}

export async function getOrganizationSettingsAction(): Promise<
  ActionResult<OrganizationSettingsResponse>
> {
  if (!(await adminUserId())) {
    return UNAUTHORIZED;
  }

  try {
    const settings = await getOrganizationService().get();
    return { ok: true, data: { settings } };
  } catch (error) {
    console.error("[admin] reading organization settings failed:", error);
    return { ok: false, error: "Could not load settings.", code: "internal" };
  }
}

export async function updateOrganizationSettingsAction(
  input: OrganizationSettingsInput,
): Promise<ActionResult<OrganizationSettingsResponse>> {
  if (!(await adminUserId())) {
    return UNAUTHORIZED;
  }

  const parsed = organizationSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Check the settings and try again.",
      code: "validation",
    };
  }

  try {
    const settings = await getOrganizationService().update(parsed.data);
    return { ok: true, data: { settings } };
  } catch (error) {
    console.error("[admin] updating organization settings failed:", error);
    return { ok: false, error: "Could not save settings.", code: "internal" };
  }
}

export async function getDriveStatusAction(): Promise<ActionResult<DriveStatus>> {
  if (!(await adminUserId())) {
    return UNAUTHORIZED;
  }

  return { ok: true, data: await checkDriveStatus() };
}
