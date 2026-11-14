export interface Limiter {
  <T>(task: () => Promise<T>): Promise<T>;
  readonly active: number;
  readonly queued: number;
}

/**
 * Bounds how many Drive requests run at once. The spec caps download concurrency at
 * four per service account by default.
 */
export function createLimiter(max: number): Limiter {
  if (!Number.isInteger(max) || max < 1) {
    throw new Error(`Limiter size must be a positive integer, received ${max}.`);
  }

  let active = 0;
  const queue: Array<() => void> = [];

  const limiter = <T>(task: () => Promise<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const run = () => {
        active += 1;
        task()
          .then(resolve, reject)
          .finally(() => {
            active -= 1;
            const next = queue.shift();
            if (next) {
              next();
            }
          });
      };

      if (active < max) {
        run();
      } else {
        queue.push(run);
      }
    });

  return Object.defineProperties(limiter, {
    active: { get: () => active },
    queued: { get: () => queue.length },
  }) as Limiter;
}
