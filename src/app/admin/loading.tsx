import { DataTable, Skeleton } from "@/components/ui";

const COLUMNS = [
  { key: "title", header: "Album" },
  { key: "status", header: "Status" },
  { key: "photos", header: "Photos", numeric: true },
  { key: "shares", header: "Shares", numeric: true },
  { key: "updated", header: "Updated" },
];

export default function AdminLoading() {
  return (
    <section className="admin-page" aria-busy="true" aria-label="Loading organizer dashboard">
      <header className="admin-page-header">
        <div>
          <p className="admin-eyebrow">Organizer</p>
          <div style={{ width: "16rem", maxWidth: "100%" }}>
            <Skeleton lines={1} height="44px" />
          </div>
          <div style={{ width: "12rem", maxWidth: "100%", marginTop: "8px" }}>
            <Skeleton lines={1} height="14px" />
          </div>
        </div>
      </header>

      <div className="admin-metrics">
        {Array.from({ length: 3 }, (_, index) => (
          <article key={index} className="admin-metric">
            <Skeleton lines={1} height="12px" />
            <Skeleton lines={1} height="32px" />
            <Skeleton lines={1} height="12px" />
          </article>
        ))}
      </div>

      <div className="admin-drive-band">
        <div style={{ width: "16rem", maxWidth: "100%" }}>
          <Skeleton lines={1} height="14px" />
        </div>
      </div>

      <section className="admin-recent" aria-label="Recent albums">
        <div className="admin-recent-head">
          <div style={{ width: "10rem" }}>
            <Skeleton lines={1} height="20px" />
          </div>
          <div style={{ width: "6rem" }}>
            <Skeleton lines={1} height="14px" />
          </div>
        </div>

        <DataTable
          loading
          rowKeyField="id"
          columns={COLUMNS}
          rows={[]}
          caption="Loading recent albums"
        />
      </section>
    </section>
  );
}
