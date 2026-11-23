import type { ShareMode } from "@/contracts/share";
import type { ShareIndexQuery } from "@/contracts/share";
import { SHARE_MODES } from "@/contracts/share";

/** URL state for the shares index. Unknown values fall back to the defaults. */
export interface ShareIndexUrlState {
  mode: ShareMode | null;
  expired: boolean | null;
  search: string;
  sort: "newest" | "expiring";
  page: number;
}

type RawParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseShareIndexParams(params: RawParams): ShareIndexUrlState {
  const mode = firstValue(params.mode);
  const expired = firstValue(params.expired);
  const sort = firstValue(params.sort);
  const page = Number(firstValue(params.page) ?? "1");

  return {
    mode: SHARE_MODES.includes(mode as ShareMode) ? (mode as ShareMode) : null,
    expired: expired === "1" ? true : expired === "0" ? false : null,
    search: firstValue(params.search)?.trim() ?? "",
    sort: sort === "expiring" ? "expiring" : "newest",
    page: Number.isFinite(page) && page >= 1 ? Math.trunc(page) : 1,
  };
}

export function toShareIndexQuery(state: ShareIndexUrlState): ShareIndexQuery {
  return {
    mode: state.mode ?? undefined,
    expired: state.expired ?? undefined,
    search: state.search || undefined,
    sort: state.sort,
    page: state.page,
  };
}

/** Builds an href for one change, keeping the rest of the index state. */
export function shareIndexHref(
  state: ShareIndexUrlState,
  patch: Partial<ShareIndexUrlState>,
): string {
  const next = { ...state, ...patch };
  const params = new URLSearchParams();

  if (next.mode) {
    params.set("mode", next.mode);
  }
  if (next.expired !== null) {
    params.set("expired", next.expired ? "1" : "0");
  }
  if (next.search) {
    params.set("search", next.search);
  }
  if (next.sort !== "newest") {
    params.set("sort", next.sort);
  }
  if (next.page > 1) {
    params.set("page", String(next.page));
  }

  const query = params.toString();
  return query ? `/admin/shares?${query}` : "/admin/shares";
}
