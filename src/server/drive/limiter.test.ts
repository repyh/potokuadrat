import { describe, expect, it } from "vitest";

import { createLimiter } from "./limiter";

function deferred() {
  let resolve: () => void = () => {};
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("createLimiter", () => {
  it("never runs more than the configured number of tasks", async () => {
    const limiter = createLimiter(2);
    const gates = [deferred(), deferred(), deferred()];
    let peak = 0;

    const tasks = gates.map((gate) =>
      limiter(async () => {
        peak = Math.max(peak, limiter.active);
        await gate.promise;
      }),
    );

    expect(limiter.active).toBe(2);
    expect(limiter.queued).toBe(1);

    gates[0].resolve();
    await tasks[0];
    await Promise.resolve();

    gates[1].resolve();
    gates[2].resolve();
    await Promise.all(tasks);

    expect(peak).toBe(2);
    expect(limiter.active).toBe(0);
  });

  it("rejects invalid sizes", () => {
    expect(() => createLimiter(0)).toThrow();
    expect(() => createLimiter(1.5)).toThrow();
  });
});
