import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import AlbumDetailLoading from "./albums/[id]/loading";
import AlbumsLoading from "./albums/loading";
import NewAlbumLoading from "./albums/new/loading";
import DriveLoading from "./drive/loading";
import AdminLoading from "./loading";
import SettingsLoading from "./settings/loading";
import SharesLoading from "./shares/loading";
import ShareDetailLoading from "./shares/[id]/loading";
import NewShareLoading from "./shares/new/loading";

function render(component: ComponentType): string {
  return renderToStaticMarkup(createElement(component));
}

describe("admin loading boundaries", () => {
  it("keeps the overview shape without a visible table caption", () => {
    const markup = render(AdminLoading);

    expect(markup).toContain("admin-metrics");
    expect(markup).toContain("admin-drive-band");
    expect(markup).toContain("specimen-inline-cluster");
    expect(markup).toContain('aria-label="Loading recent albums"');
    expect(markup).not.toContain("<caption");
  });

  it("gives every admin route its own header, toolbar, and table shape", () => {
    const albums = render(AlbumsLoading);
    const shares = render(SharesLoading);

    expect(albums).toContain('aria-label="Loading albums"');
    expect(albums).toContain("Cover + title");
    expect(albums).toContain("admin-toolbar");
    expect(albums).not.toContain("admin-metrics");

    expect(shares).toContain('aria-label="Loading shares"');
    expect(shares).toContain("Album + link");
    expect(shares).toContain("admin-sort");
    expect(shares).not.toContain("admin-metrics");
  });

  it("mirrors the settings tabs and the new album and share fieldsets", () => {
    const settings = render(SettingsLoading);
    const newAlbum = render(NewAlbumLoading);
    const newShare = render(NewShareLoading);

    expect(settings).toContain('aria-label="Loading settings"');
    expect(settings).toContain("ui-tablist");
    expect(settings).toContain("admin-settings-panel");

    expect(newAlbum).toContain('aria-label="Loading new album"');
    expect(newAlbum).toContain("admin-cover-placeholder");
    expect(newAlbum).toContain("ui-fieldset");

    expect(newShare).toContain('aria-label="Loading new share"');
    expect(newShare).toContain("ui-fieldset");
  });

  it("mirrors the album, share, and drive breadcrumbs, fieldsets, and tables", () => {
    const album = render(AlbumDetailLoading);
    const share = render(ShareDetailLoading);
    const drive = render(DriveLoading);

    expect(album).toContain('aria-label="Loading album detail"');
    expect(album).toContain("ui-breadcrumbs");
    expect(album).toContain("ui-fieldset");
    expect(album).toContain("Access");
    expect(album).not.toContain("admin-metrics");

    expect(share).toContain('aria-label="Loading share detail"');
    expect(share).toContain("ui-breadcrumbs");
    expect(share).toContain("ui-fieldset");
    expect(share).toContain("admin-metrics");

    expect(drive).toContain('aria-label="Loading drive"');
    expect(drive).toContain("ui-fieldset");
    expect(drive).toContain("Folder");
  });
});
