import {
  AdminHeaderSkeleton,
  AdminTableSkeleton,
  AdminToolbarSkeleton,
  type AdminSkeletonColumn,
} from "@/features/admin/loading-skeletons";

const COLUMNS: AdminSkeletonColumn[] = [
  { header: "Album + link", primary: "stacked" },
  { header: "Mode" },
  { header: "Expires" },
  { header: "Downloads" },
  { header: "Visits", numeric: true },
  { header: "Actions", numeric: true, end: true },
];

export default function SharesLoading() {
  return (
    <section className="admin-page" aria-busy="true" aria-label="Loading shares">
      <AdminHeaderSkeleton
        titleWidth="9rem"
        count
        ledeWidth="18rem"
        actions={["7.7rem"]}
      />
      <AdminToolbarSkeleton variant="shares" />
      <AdminTableSkeleton label="Loading shares" columns={COLUMNS} rows={5} />
    </section>
  );
}
