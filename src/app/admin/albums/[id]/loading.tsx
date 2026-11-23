import { Skeleton } from "@/components/ui";
import {
  AdminFieldsetSkeleton,
  AdminFieldSkeleton,
  AdminHeaderSkeleton,
  AdminTableSkeleton,
  type AdminSkeletonColumn,
} from "@/features/admin/loading-skeletons";

const SHARE_COLUMNS: AdminSkeletonColumn[] = [
  { header: "Link" },
  { header: "Access" },
  { header: "Visits", numeric: true },
  { header: "Expires" },
  { header: "Downloads" },
  { header: "Actions", numeric: true, end: true },
];

export default function AlbumDetailLoading() {
  return (
    <section
      className="admin-page"
      aria-busy="true"
      aria-label="Loading album detail"
    >
      <nav aria-label="Breadcrumb" className="ui-breadcrumbs">
        <ol className="ui-breadcrumbs-list">
          <li className="ui-breadcrumbs-item">
            <span className="ui-skeleton-bar" style={{ width: "3.5rem", height: "12px" }} />
          </li>
          <li className="ui-breadcrumbs-item">
            <span className="ui-skeleton-bar" style={{ width: "6rem", height: "12px" }} />
          </li>
        </ol>
      </nav>

      <AdminHeaderSkeleton titleWidth="14rem" ledeWidth="12rem" />

      <AdminFieldsetSkeleton titleWidth="8rem" descriptionWidth="20rem">
        <AdminFieldSkeleton inputWidth="24rem" hintWidth={null} />
        <div style={{ width: "6rem" }}>
          <Skeleton lines={1} height="44px" />
        </div>
      </AdminFieldsetSkeleton>

      <AdminFieldsetSkeleton titleWidth="8rem" descriptionWidth="22rem">
        <div className="ui-progress">
          <div className="ui-progress-header">
            <div style={{ width: "8rem" }}>
              <Skeleton lines={1} height="13px" />
            </div>
            <div style={{ width: "5rem" }}>
              <Skeleton lines={1} height="13px" />
            </div>
          </div>
          <div className="ui-progress-track">
            <div className="ui-progress-fill" style={{ width: "60%" }} />
          </div>
        </div>

        <div className="admin-folder-list">
          <div className="admin-folder-row">
            <div className="admin-table-primary" style={{ width: "16rem", maxWidth: "100%" }}>
              <span className="ui-skeleton-bar" style={{ height: "14px", width: "70%" }} />
              <span className="ui-skeleton-bar" style={{ height: "12px", width: "50%" }} />
            </div>
            <div style={{ width: "7rem" }}>
              <Skeleton lines={1} height="20px" />
            </div>
          </div>
        </div>

        <AdminFieldSkeleton hintWidth={null} />

        <div style={{ width: "9rem" }}>
          <Skeleton lines={1} height="36px" />
        </div>

        <div className="specimen-inline-cluster">
          <div style={{ width: "10rem" }}>
            <Skeleton lines={1} height="44px" />
          </div>
          <div style={{ width: "7rem" }}>
            <Skeleton lines={1} height="44px" />
          </div>
        </div>
      </AdminFieldsetSkeleton>

      <AdminFieldsetSkeleton titleWidth="8rem" descriptionWidth="22rem">
        <div style={{ width: "9rem" }}>
          <Skeleton lines={1} height="44px" />
        </div>
        <AdminTableSkeleton
          label="Loading share links"
          columns={SHARE_COLUMNS}
          rows={3}
        />
      </AdminFieldsetSkeleton>

      <AdminFieldsetSkeleton titleWidth="8rem" descriptionWidth="24rem">
        <div style={{ width: "8rem" }}>
          <Skeleton lines={1} height="44px" />
        </div>
      </AdminFieldsetSkeleton>
    </section>
  );
}
