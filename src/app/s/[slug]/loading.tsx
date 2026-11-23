import { Skeleton } from "@/components/ui";
import { ShareGridSkeleton } from "@/features/share/share-grid-skeleton";

export default function ShareLoading() {
  return (
    <main className="folio-frame" aria-busy="true" aria-label="Loading folio">
      <header className="site-navbar">
        <div className="navbar-inner">
          <div className="navbar-brand">
            <span
              className="ui-skeleton-bar"
              style={{ width: "36px", height: "40px", flex: "0 0 auto" }}
            />
            <div style={{ width: "8rem" }}>
              <Skeleton lines={1} height="20px" />
            </div>
          </div>

          <div className="navbar-actions" aria-hidden="true">
            <div style={{ width: "5rem" }}>
              <Skeleton lines={1} height="14px" />
            </div>
          </div>
        </div>
      </header>

      <div className="folio-page">
        <div className="share-folio" aria-busy="true">
          <header className="share-header">
            <div className="share-header-copy">
              <div style={{ width: "8rem" }}>
                <Skeleton lines={1} height="12px" />
              </div>
              <div style={{ width: "18rem", maxWidth: "100%" }}>
                <Skeleton lines={1} height="clamp(34px, 4.8vw, 56px)" />
              </div>
              <div style={{ width: "12rem", maxWidth: "100%" }}>
                <Skeleton lines={1} height="14px" />
              </div>
            </div>

            <div className="share-header-actions">
              <div style={{ width: "7.2rem" }}>
                <Skeleton lines={1} height="44px" />
              </div>
            </div>
          </header>

          <div className="share-toolbar">
            <div className="share-filter-row" aria-hidden="true">
              {["3.2rem", "5.8rem", "5.4rem", "4.8rem"].map((width) => (
                <span
                  key={width}
                  className="ui-skeleton-bar"
                  style={{ width, height: "36px" }}
                />
              ))}
            </div>
            <div
              className="share-toolbar-count"
              aria-hidden="true"
              style={{ width: "7rem" }}
            >
              <Skeleton lines={1} height="13px" />
            </div>
          </div>

          <ShareGridSkeleton label="Loading photographs" />
        </div>
      </div>
    </main>
  );
}
