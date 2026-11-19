import { AdminDashboardSkeleton } from "@/features/states";

export default function AdminLoading() {
  return (
    <section className="admin-section" aria-busy="true">
      <AdminDashboardSkeleton />
    </section>
  );
}
