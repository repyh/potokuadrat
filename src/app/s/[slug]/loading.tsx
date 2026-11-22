import { Skeleton } from "@/components/ui";

const TILE_COUNT = 8;

export default function ShareLoading() {
  return (
    <main className="folio-frame" aria-busy="true" aria-label="Loading folio">
      <header className="site-navbar">
        <div className="navbar-inner">
          <div className="navbar-brand">
            <div style={{ width: "10rem" }}>
              <Skeleton lines={1} height="18px" />
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
                <Skeleton lines={1} height="40px" />
              </div>
              <div style={{ width: "12rem", maxWidth: "100%" }}>
                <Skeleton lines={1} height="14px" />
              </div>
            </div>
            <div className="share-header-actions">
              <div style={{ width: "9rem" }}>
                <Skeleton lines={1} height="40px" />
              </div>
            </div>
          </header>

          <div className="share-toolbar">
            <div style={{ width: "14rem", maxWidth: "100%" }}>
              <Skeleton lines={1} height="32px" />
            </div>
          </div>

          <div className="share-grid">
            {Array.from({ length: TILE_COUNT }, (_, index) => (
              <div key={index} className="share-tile share-tile-skeleton">
                <Skeleton lines={1} height="220px" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
