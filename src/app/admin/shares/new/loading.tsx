import { Skeleton } from "@/components/ui";
import {
  AdminFieldsetSkeleton,
  AdminFieldSkeleton,
  AdminHeaderSkeleton,
} from "@/features/admin/loading-skeletons";

export default function NewShareLoading() {
  return (
    <section className="admin-page" aria-busy="true" aria-label="Loading new share">
      <AdminHeaderSkeleton
        titleWidth="10rem"
        ledeWidth="24rem"
        actions={["5.2rem", "8.4rem"]}
      />

      <div className="admin-settings-sections">
        <AdminFieldsetSkeleton titleWidth="10rem" descriptionWidth="22rem">
          <AdminFieldSkeleton hintWidth="14rem" />
          <div style={{ width: "16rem", maxWidth: "100%" }}>
            <Skeleton lines={3} height="18px" />
          </div>
        </AdminFieldsetSkeleton>

        <AdminFieldsetSkeleton titleWidth="11rem" descriptionWidth="24rem">
          <div style={{ width: "18rem", maxWidth: "100%" }}>
            <Skeleton lines={2} height="18px" />
          </div>
          <AdminFieldSkeleton hintWidth="16rem" />
        </AdminFieldsetSkeleton>
      </div>
    </section>
  );
}
