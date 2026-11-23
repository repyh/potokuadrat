import { Skeleton } from "@/components/ui";
import {
  AdminFieldSkeleton,
  AdminHeaderSkeleton,
} from "@/features/admin/loading-skeletons";

const TAB_WIDTHS = ["4.4rem", "8.2rem", "6.2rem", "5.6rem", "6.4rem", "4.2rem"];

export default function SettingsLoading() {
  return (
    <section className="admin-page" aria-busy="true" aria-label="Loading settings">
      <AdminHeaderSkeleton titleWidth="9rem" />

      <div className="ui-tabs">
        <div
          className="ui-tablist"
          role="tablist"
          aria-label="Settings sections"
          aria-hidden="true"
        >
          {TAB_WIDTHS.map((width) => (
            <span key={width} className="ui-tab">
              <span
                className="ui-skeleton-bar"
                style={{ width, height: "13px" }}
              />
            </span>
          ))}
        </div>

        <div className="admin-settings-panel">
          <div style={{ width: "34rem", maxWidth: "100%" }}>
            <Skeleton lines={1} height="14px" />
          </div>

          <div className="specimen-form-grid">
            {Array.from({ length: 4 }, (_, index) => (
              <AdminFieldSkeleton key={index} />
            ))}
          </div>

          <div style={{ width: "8.5rem" }}>
            <Skeleton lines={1} height="44px" />
          </div>
        </div>
      </div>
    </section>
  );
}
