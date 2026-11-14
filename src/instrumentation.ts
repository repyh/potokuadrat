export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs" || !process.env.DATABASE_URL) {
    return;
  }

  try {
    const { startWorkers } = await import("@/server/jobs");
    await startWorkers();
  } catch (error) {
    // A failed worker must not take the web process down; album creation will surface
    // the failure when it cannot enqueue.
    console.error("[jobs] failed to start workers:", error);
  }
}
