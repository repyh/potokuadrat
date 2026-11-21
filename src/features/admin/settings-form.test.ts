import { describe, expect, it } from "vitest";
import { getDriveStatusAlert } from "./settings-form";

describe("SettingsForm Helpers", () => {
  it("maps reachable drive status to success tone and folder count title", () => {
    const alert = getDriveStatusAlert({
      state: "reachable",
      message: "Drive is online.",
      folderCount: 5,
      checkedAt: "2026-11-21T10:00:00.000Z",
    });
    expect(alert.tone).toBe("success");
    expect(alert.title).toBe("Connected (5 folders visible)");
  });

  it("handles single folder visible grammatical agreement", () => {
    const alert = getDriveStatusAlert({
      state: "reachable",
      message: "Drive is online.",
      folderCount: 1,
      checkedAt: "2026-11-21T10:00:00.000Z",
    });
    expect(alert.tone).toBe("success");
    expect(alert.title).toBe("Connected (1 folder visible)");
  });

  it("maps failing drive status to danger tone", () => {
    const alert = getDriveStatusAlert({
      state: "failing",
      message: "Invalid credentials.",
      folderCount: 0,
      checkedAt: "2026-11-21T10:00:00.000Z",
    });
    expect(alert.tone).toBe("danger");
    expect(alert.title).toBe("Connection failing");
  });

  it("maps not_configured drive status to neutral tone", () => {
    const alert = getDriveStatusAlert({
      state: "not_configured",
      message: "No key file provided.",
      folderCount: 0,
      checkedAt: "2026-11-21T10:00:00.000Z",
    });
    expect(alert.tone).toBe("neutral");
    expect(alert.title).toBe("Not configured");
  });
});
