/** Result shape for every admin Server Action. */
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string };
