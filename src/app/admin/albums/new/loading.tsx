import { Skeleton } from "@/components/ui";
import {
  AdminFieldsetSkeleton,
  AdminFieldSkeleton,
  AdminHeaderSkeleton,
} from "@/features/admin/loading-skeletons";

export default function NewAlbumLoading() {
  return (
    <section className="admin-page" aria-busy="true" aria-label="Loading new album">
      <AdminHeaderSkeleton
        eyebrow
        titleWidth="11rem"
        ledeWidth="20rem"
        actions={["5.2rem", "8rem"]}
      />

      <div className="admin-settings-sections">
        <AdminFieldsetSkeleton titleWidth="9rem" descriptionWidth="20rem">
          <div className="specimen-form-grid">
            <AdminFieldSkeleton hintWidth="12rem" />
            <AdminFieldSkeleton hintWidth="14rem" />
          </div>

          <div className="admin-cover-placeholder">
            <span
              className="ui-skeleton-bar"
              style={{ width: "36px", height: "36px", flex: "0 0 auto" }}
            />
            <div style={{ width: "18rem", maxWidth: "100%" }}>
              <Skeleton lines={1} height="13px" />
            </div>
          </div>
        </AdminFieldsetSkeleton>

        <AdminFieldsetSkeleton titleWidth="8rem" descriptionWidth="22rem">
          <div className="admin-folder-list">
            {Array.from({ length: 2 }, (_, index) => (
              <div key={index} className="admin-folder-row">
                <div style={{ width: "14rem", maxWidth: "100%" }}>
                  <Skeleton lines={1} height="13px" />
                </div>
                <div style={{ width: "7rem" }}>
                  <Skeleton lines={1} height="20px" />
                </div>
              </div>
            ))}
          </div>

          <AdminFieldSkeleton hintWidth="16rem" />

          <div style={{ width: "18rem", maxWidth: "100%" }}>
            <Skeleton lines={1} height="13px" />
          </div>
        </AdminFieldsetSkeleton>

        <div style={{ width: "26rem", maxWidth: "100%" }}>
          <Skeleton lines={1} height="13px" />
        </div>
      </div>
    </section>
  );
}
