const stack = [
  {
    name: "Next.js 16",
    detail: "App Router dan Route Handlers sebagai backend-for-frontend.",
  },
  {
    name: "Supabase",
    detail: "Postgres untuk data dan Storage untuk berkas.",
  },
  {
    name: "Drizzle + Tailwind",
    detail: "Schema dan migrasi SQL yang eksplisit, dengan styling utility-first.",
  },
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-6 py-20 sm:px-10">
      <div className="mb-10 inline-flex w-fit items-center gap-2 rounded-full border border-foreground/10 px-3 py-1 text-sm text-foreground/65">
        <span className="size-2 rounded-full bg-emerald-500" aria-hidden="true" />
        Fondasi proyek siap
      </div>

      <h1 className="max-w-3xl text-5xl font-semibold tracking-tight sm:text-7xl">
        Potokuadrat
      </h1>
      <p className="mt-5 max-w-2xl text-lg leading-8 text-foreground/65">
        Kerangka aplikasi sudah tersedia. Arsitektur memisahkan antarmuka,
        aturan domain, akses data, dan penyimpanan berkas agar fitur dapat
        dikembangkan tanpa mengikat kontrak aplikasi ke skema database.
      </p>

      <section aria-labelledby="stack-heading" className="mt-14">
        <h2 id="stack-heading" className="text-sm font-medium uppercase tracking-[0.18em] text-foreground/50">
          Stack
        </h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {stack.map((item) => (
            <article
              key={item.name}
              className="rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-5"
            >
              <h3 className="font-medium">{item.name}</h3>
              <p className="mt-2 text-sm leading-6 text-foreground/60">
                {item.detail}
              </p>
            </article>
          ))}
        </div>
      </section>

      <p className="mt-10 text-sm text-foreground/55">
        Mulai dari docs/ARCHITECTURE.md dan .env.example.
      </p>
    </main>
  );
}
