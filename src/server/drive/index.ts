import "server-only";

import { createDriveClient, type DriveClient } from "./client";
import { loadServiceAccount, readDriveConfig, type DriveConfig } from "./config";
import { createThumbnailCache, type ThumbnailCache } from "./thumb-cache";

interface DriveRuntime {
  config: DriveConfig;
  client: DriveClient;
  cache: ThumbnailCache;
}

let runtime: DriveRuntime | null = null;

/**
 * Lazily wires the Drive client and thumbnail cache from the environment. Keeping the
 * construction here means route handlers never read credentials or cache paths.
 */
export function getDriveRuntime(): DriveRuntime {
  if (!runtime) {
    const config = readDriveConfig();
    const client = createDriveClient({
      serviceAccount: () => loadServiceAccount(config.keyFile),
      maxDepth: config.indexMaxDepth,
      concurrency: config.concurrency,
    });
    const cache = createThumbnailCache({
      dir: config.cacheDir,
      drive: client,
      maxBytes: config.cacheMaxBytes,
      maxFiles: config.cacheMaxFiles,
    });

    runtime = { config, client, cache };
  }

  return runtime;
}
