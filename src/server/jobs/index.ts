import "server-only";

import type { Job, PgBoss } from "pg-boss";

import { getBoss } from "./boss";

export const INDEX_ALBUM_JOB = "index-album";

export interface IndexAlbumJobData {
  albumId: string;
  mode?: "full" | "incremental";
}

const queueOptions = {
  retryLimit: 2,
  retryDelay: 30,
  retryBackoff: true,
} as const;

let queuesPromise: Promise<void> | null = null;

async function ensureQueues(boss: PgBoss): Promise<void> {
  if (!queuesPromise) {
    queuesPromise = boss.createQueue(INDEX_ALBUM_JOB, queueOptions).catch((error) => {
      queuesPromise = null;
      throw error;
    });
  }
  await queuesPromise;
}

export async function enqueueIndexAlbum(
  albumId: string,
  options: { mode?: "full" | "incremental" } = {},
  boss?: PgBoss,
): Promise<void> {
  const instance = boss ?? (await getBoss());
  await ensureQueues(instance);

  await instance.send(
    INDEX_ALBUM_JOB,
    { albumId, mode: options.mode ?? "full" } satisfies IndexAlbumJobData,
    {
      // One pending index per album: a re-index replaces the previous queued run.
      singletonKey: albumId,
    },
  );
}

/**
 * Registers the v1 workers in the app process. The dynamic imports break the
 * jobs -> albums -> jobs module cycle.
 */
export async function startWorkers(): Promise<void> {
  const boss = await getBoss();
  await ensureQueues(boss);
  const [{ getAlbumRepository }, { getDriveRuntime }, { indexAlbum }] = await Promise.all([
    import("@/server/albums/runtime"),
    import("@/server/drive"),
    import("@/server/albums/indexing"),
  ]);

  await boss.work<IndexAlbumJobData>(INDEX_ALBUM_JOB, async (jobs: Job<IndexAlbumJobData>[]) => {
    const repository = getAlbumRepository();

    for (const job of jobs) {
      try {
        await indexAlbum(
          job.data.albumId,
          {
            repository,
            drive: getDriveRuntime().client,
          },
          { mode: job.data.mode ?? "full" },
        );
      } catch (error) {
        // Covers failures before indexAlbum runs, such as missing Drive credentials.
        await repository.setStatus(job.data.albumId, "failed").catch(() => {});
        throw error;
      }
    }
  });
}
