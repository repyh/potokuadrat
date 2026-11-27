import { Skeleton } from "@/components/ui";
import {
  AdminFieldsetSkeleton,
  AdminFieldSkeleton,
  AdminHeaderSkeleton,
  AdminTableSkeleton,
  type AdminSkeletonColumn,
} from "@/features/admin/loading-skeletons";

const FOLDER_COLUMNS: AdminSkeletonColumn[] = [
  { header: "Folder", primary: "stacked" },
  { header: "Source" },
  { header: "Owner" },
  { header: "Actions", numeric: true, end: true },
];

export default function DriveLoading() {
  return (
    <section className="admin-page" aria-busy="true" aria-label="Loading drive">
      <AdminHeaderSkeleton
        titleWidth="8rem"
        ledeWidth="24rem"
        actions={["10rem"]}
      />

      <AdminFieldsetSkeleton titleWidth="9rem" descriptionWidth="22rem">
        <Skeleton lines={2} height="16px" />
      </AdminFieldsetSkeleton>

      <AdminFieldsetSkeleton titleWidth="8rem" descriptionWidth="18rem">
        <AdminTableSkeleton
          label="Loading shared folders"
          columns={FOLDER_COLUMNS}
          rows={3}
        />
      </AdminFieldsetSkeleton>

      <AdminFieldsetSkeleton titleWidth="10rem" descriptionWidth="20rem">
        <AdminFieldSkeleton hintWidth={null} />
      </AdminFieldsetSkeleton>
    </section>
  );
}
