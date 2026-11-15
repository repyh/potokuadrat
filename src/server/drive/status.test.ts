import { describe, expect, it, vi } from "vitest";

import { createDriveStatusCheck } from "./status";

const now = new Date("2026-11-15T10:00:00Z");

type Folder = { id: string; name: string; source: "shared" | "shared_drive"; ownerName: string | null };

function build(overrides: {
  configured?: boolean;
  drives?: () => Promise<Folder[]>;
  folders?: () => Promise<Folder[]>;
}) {
  const drive = {
    listSharedDrives: vi.fn(
      overrides.drives ??
        (async () => [{ id: "drive-1", name: "Drive", source: "shared_drive" as const, ownerName: null }]),
    ),
    listSharedFolders: vi.fn(
      overrides.folders ??
        (async () => [
          { id: "folder-1", name: "One", source: "shared" as const, ownerName: null },
          { id: "folder-2", name: "Two", source: "shared" as const, ownerName: null },
        ]),
    ),
  };

  return {
    drive,
    check: createDriveStatusCheck({
      configured: () => overrides.configured ?? true,
      drive: () => drive,
      now: () => now,
    }),
  };
}

describe("createDriveStatusCheck", () => {
  it("reports missing credentials without touching Drive", async () => {
    const { check, drive } = build({ configured: false });

    expect(await check()).toEqual({
      state: "not_configured",
      message: "Google Drive credentials are not configured.",
      folderCount: null,
      checkedAt: now.toISOString(),
    });
    expect(drive.listSharedDrives).not.toHaveBeenCalled();
  });

  it("counts the folders the service account can see", async () => {
    const { check } = build({});

    expect(await check()).toEqual({
      state: "reachable",
      message: "Drive is reachable.",
      folderCount: 3,
      checkedAt: now.toISOString(),
    });
  });

  it("reports a failure without leaking the underlying error", async () => {
    const { check } = build({
      drives: async () => {
        throw new Error("invalid_grant: private key for bot@example.com is wrong");
      },
    });

    const status = await check();

    expect(status).toMatchObject({ state: "failing", folderCount: null });
    expect(status.message).not.toContain("private key");
    expect(status.message).not.toContain("bot@example.com");
  });
});
