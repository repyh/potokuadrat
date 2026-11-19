import { describe, expect, it } from "vitest";
import {
  DriveStateAlert,
  EmptyFavoritesPrompt,
  ExpiredFolioAlert,
  NoAlbumsEmptyState,
  NoSharesEmptyState,
  PhotoGridSkeleton,
  UnavailableFolioState,
} from "./index";

describe("Organizer States (Figma O11)", () => {
  it("renders NoAlbumsEmptyState with default and custom CTA", () => {
    const defaultState = NoAlbumsEmptyState({});
    expect(defaultState).toBeDefined();
    expect(defaultState.props.title).toBe("No albums in your folio yet");

    let count = 0;
    const customState = NoAlbumsEmptyState({ onCreateAlbum: () => { count += 1; } });
    expect(customState.props.action).toBeDefined();
    expect(count).toBe(0);
  });

  it("renders NoSharesEmptyState with action button", () => {
    let count = 0;
    const state = NoSharesEmptyState({ onCreateShare: () => { count += 1; } });
    expect(state.props.title).toBe("No active share links");
    expect(state.props.action).toBeDefined();
    expect(count).toBe(0);
  });

  it("renders DriveStateAlert for all error variants", () => {
    const failedAlert = DriveStateAlert({ status: "indexing_failed" });
    expect(failedAlert.props.tone).toBe("danger");
    expect(failedAlert.props.title).toBe("Google Drive indexing failed");

    const unsharedAlert = DriveStateAlert({ status: "folder_unshared" });
    expect(unsharedAlert.props.tone).toBe("warning");
    expect(unsharedAlert.props.title).toBe("Drive folder permission revoked");

    const saAlert = DriveStateAlert({ status: "service_account_rejected" });
    expect(saAlert.props.tone).toBe("danger");
    expect(saAlert.props.title).toBe("Service account authentication rejected");
  });
});

describe("Client States (Figma C6)", () => {
  it("renders PhotoGridSkeleton with correct count and aria attributes", () => {
    const skeleton = PhotoGridSkeleton({ count: 6 });
    expect(skeleton.props["aria-busy"]).toBe("true");
    expect(skeleton.props.children).toHaveLength(6);
  });

  it("renders EmptyFavoritesPrompt with Show all photos action", () => {
    let count = 0;
    const prompt = EmptyFavoritesPrompt({ onShowAll: () => { count += 1; } });
    expect(prompt.props.title).toBe("No favorite photos yet");
    expect(prompt.props.action).toBeDefined();
    expect(count).toBe(0);
  });

  it("renders ExpiredFolioAlert with custom and default contact prompt", () => {
    const alertDefault = ExpiredFolioAlert({});
    expect(alertDefault.props.children.props.children[1].props.children).toBe("Link expired");

    const alertCustom = ExpiredFolioAlert({ contactEmail: "lead@potokuadrat.org" });
    expect(alertCustom).toBeDefined();
  });

  it("renders UnavailableFolioState with default message", () => {
    const unavail = UnavailableFolioState({});
    expect(unavail.props.children.props.children[1].props.children).toBe("Folio unavailable");
  });
});
