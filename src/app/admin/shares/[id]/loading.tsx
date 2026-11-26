import { Skeleton } from "@/components/ui";
import {
  AdminFieldsetSkeleton,
  AdminFieldSkeleton,
  AdminHeaderSkeleton,
} from "@/features/admin/loading-skeletons";

export default function ShareDetailLoading() {
  return (
    <section className="admin-page" aria-busy="true" aria-label="Loading share detail">
      <nav aria-label="Breadcrumb" className="ui-breadcrumbs">
        <ol className="ui-breadcrumbs-list">
          <li className="ui-breadcrumbs-item">
            <span className="ui-skeleton-bar" style={{ width: "3.5rem", height: "12px" }} />
          </li>
          <li className="ui-breadcrumbs-item">
            <span className="ui-skeleton-bar" style={{ width: "7rem", height: "12px" }} />
          </li>
        </ol>
      </nav>

      <AdminHeaderSkeleton
        titleWidth="15rem"
        ledeWidth="18rem"
        actions={["6.5rem", "7.5rem"]}
      />

      <div className="admin-metrics is-four" aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="admin-metric">
            <Skeleton lines={1} height="12px" />
            <Skeleton lines={1} height="28px" />
            <Skeleton lines={1} height="12px" />
          </div>
        ))}
      </div>

      <AdminFieldsetSkeleton titleWidth="10rem" descriptionWidth="22rem">
        <AdminFieldSkeleton inputWidth="22rem" hintWidth={null} />
        <div style={{ width: "9rem" }}>
          <Skeleton lines={1} height="44px" />
        </div>
      </AdminFieldsetSkeleton>

      <AdminFieldsetSkeleton titleWidth="10rem" descriptionWidth="22rem">
        <div style={{ width: "16rem" }}>
          <Skeleton lines={2} height="18px" />
        </div>
        <div style={{ width: "8rem" }}>
          <Skeleton lines={1} height="44px" />
        </div>
      </AdminFieldsetSkeleton>
    </section>
  );
}
