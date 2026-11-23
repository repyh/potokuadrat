import { Skeleton } from "@/components/ui";
import {
  AdminHeaderSkeleton,
  AdminTableSkeleton,
  type AdminSkeletonColumn,
} from "@/features/admin/loading-skeletons";

const COLUMNS: AdminSkeletonColumn[] = [
  { header: "Album", primary: "cover" },
  { header: "Status" },
  { header: "Photos", numeric: true },
  { header: "Shares", numeric: true },
  { header: "Updated" },
];

export default function AdminLoading() {
  return (
    <section
      className="admin-page"
      aria-busy="true"
      aria-label="Loading organizer dashboard"
    >
      <AdminHeaderSkeleton
        eyebrow
        titleWidth="14rem"
        ledeWidth="12rem"
        actions={["7.7rem"]}
      />

      <div className="admin-metrics" aria-hidden="true">
        {Array.from({ length: 3 }, (_, index) => (
          <article key={index} className="admin-metric">
            <Skeleton lines={1} height="12px" />
            <Skeleton lines={1} height="32px" />
            <Skeleton lines={1} height="12px" />
          </article>
        ))}
      </div>

      <div className="admin-drive-band" aria-hidden="true">
        <div style={{ width: "16rem", maxWidth: "100%" }}>
          <Skeleton lines={1} height="14px" />
        </div>
        <div style={{ width: "9rem" }}>
          <Skeleton lines={1} height="14px" />
        </div>
      </div>

      <section className="admin-recent" aria-label="Loading recent albums">
        <div className="admin-recent-head">
          <div style={{ width: "10rem" }}>
            <Skeleton lines={1} height="20px" />
          </div>
          <div style={{ width: "6rem" }}>
            <Skeleton lines={1} height="14px" />
          </div>
        </div>

        <AdminTableSkeleton
          label="Loading recent albums"
          columns={COLUMNS}
          rows={3}
        />
      </section>
    </section>
  );
}
