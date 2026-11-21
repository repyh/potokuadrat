import { describe, expect, it } from "vitest";
import { getOrganizationInitial, isRouteActive, NAV_ITEMS } from "./admin-shell";

describe("AdminShell Navigation & Helpers", () => {
  it("computes uppercase organization initial correctly", () => {
    expect(getOrganizationInitial("Kusuma Studio")).toBe("K");
    expect(getOrganizationInitial("potokuadrat")).toBe("P");
    expect(getOrganizationInitial("   ")).toBe("P");
  });

  it("accurately detects exact match routes (Overview /admin)", () => {
    expect(isRouteActive("/admin", "/admin", true)).toBe(true);
    expect(isRouteActive("/admin/albums", "/admin", true)).toBe(false);
    expect(isRouteActive("/admin/settings", "/admin", true)).toBe(false);
  });

  it("accurately detects prefix routes (Albums /admin/albums & Settings /admin/settings)", () => {
    expect(isRouteActive("/admin/albums", "/admin/albums", false)).toBe(true);
    expect(
      isRouteActive(
        "/admin/albums/00000000-0000-4000-8000-000000000001",
        "/admin/albums",
        false,
      ),
    ).toBe(true);
    expect(isRouteActive("/admin", "/admin/albums", false)).toBe(false);

    expect(isRouteActive("/admin/settings", "/admin/settings", false)).toBe(true);
    expect(isRouteActive("/admin/settings/team", "/admin/settings", false)).toBe(true);
    expect(isRouteActive("/admin/albums", "/admin/settings", false)).toBe(false);
  });

  it("provides 3 primary navigation sections in expected order", () => {
    expect(NAV_ITEMS).toHaveLength(3);
    expect(NAV_ITEMS[0]?.label).toBe("Overview");
    expect(NAV_ITEMS[1]?.label).toBe("Albums");
    expect(NAV_ITEMS[2]?.label).toBe("Settings");
  });
});
