import { createHash } from "node:crypto";

import { Client } from "pg";

/**
 * Test-side fixtures that the seed cannot provide because they are one-shot by
 * design.
 *
 * The magic-link token is consumed on first redemption (`consumeRecipient()`
 * stamps `used_at`), so a test that redeems it can only pass once. Rather than
 * recreate the whole seed — which also rewrites the album and every share — this
 * resets only the recipient row, which is all a re-run needs.
 *
 * The connection string is read at call time so a test can set it, and falls
 * back to the documented local default from .env.example.
 */
function connectionString(): string {
  return (
    process.env.DATABASE_URL ??
    "postgresql://potokuadrat:potokuadrat@localhost:5433/potokuadrat"
  );
}

/**
 * Rewrites the magic-link recipient for the seeded magic share with a fresh
 * token, clearing `used_at` so it can be redeemed again.
 */
export async function reseedMagicToken(token: string): Promise<void> {
  const client = new Client({ connectionString: connectionString() });
  await client.connect();

  try {
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const result = await client.query(
      `UPDATE share_recipients
         SET token_hash = $1, used_at = NULL, updated_at = now()
       WHERE email = 'guest@example.com'`,
      [tokenHash],
    );

    if (result.rowCount === 0) {
      throw new Error(
        "No seeded magic-link recipient found. Run `npm run db:seed` before the E2E suite.",
      );
    }
  } finally {
    await client.end();
  }
}
