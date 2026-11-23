import {
  AdminHeaderSkeleton,
  AdminTableSkeleton,
  AdminToolbarSkeleton,
  type AdminSkeletonColumn,
} from "@/features/admin/loading-skeletons";

const COLUMNS: AdminSkeletonColumn[] = [
  { header: "Cover + title", primary: "cover" },
  { header: "Status" },
  { header: "Photos", numeric: true },
  { header: "Shares", numeric: true },
  { header: "Updated" },
  { header: "Manage", numeric: true, end: true },
];

export default function AlbumsLoading() {
  return (
    <section className="admin-page" aria-busy="true" aria-label="Loading albums">
      <AdminHeaderSkeleton
        titleWidth="10rem"
        count
        actions={["7.7rem"]}
      />
      <AdminToolbarSkeleton variant="albums" />
      <AdminTableSkeleton label="Loading albums" columns={COLUMNS} rows={5} />
    </section>
  );
}
