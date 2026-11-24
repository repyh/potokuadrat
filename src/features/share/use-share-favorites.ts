"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";

import type { FavoritesResponse, ShareMode } from "@/contracts/share";

function storageKey(slug: string): string {
  return `potokuadrat:favorites:${slug}`;
}

const LOCAL_EVENT = "potokuadrat:favorites-change";

function subscribeLocalFavorites(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  window.addEventListener(LOCAL_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(LOCAL_EVENT, callback);
  };
}

export function parseFavoriteIds(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

export interface UseShareFavoritesResult {
  favoriteIds: Set<string>;
  favoriteList: string[];
  /** Resolves true when the change was saved, false when it was rolled back. */
  toggleFavorite: (photoId: string) => Promise<boolean>;
  error: string | null;
}

export function useShareFavorites(
  slug: string,
  mode: ShareMode,
  initialFavoriteIds: string[] = [],
): UseShareFavoritesResult {
  const [serverIds, setServerIds] = useState<string[]>(initialFavoriteIds);
  const [error, setError] = useState<string | null>(null);

  const localRaw = useSyncExternalStore(
    subscribeLocalFavorites,
    () => window.localStorage.getItem(storageKey(slug)) ?? "[]",
    () => "[]",
  );

  const ids = useMemo(
    () => (mode === "magic_link" ? serverIds : parseFavoriteIds(localRaw)),
    [localRaw, mode, serverIds],
  );

  const favoriteIds = useMemo(() => new Set(ids), [ids]);

  const toggleFavorite = useCallback(
    async (photoId: string) => {
      setError(null);
      const isFav = ids.includes(photoId);
      const next = isFav ? ids.filter((id) => id !== photoId) : [...ids, photoId];

      if (mode !== "magic_link") {
        try {
          window.localStorage.setItem(storageKey(slug), JSON.stringify(next));
          window.dispatchEvent(new Event(LOCAL_EVENT));
          return true;
        } catch {
          setError("Unable to save favorites in this browser.");
          return false;
        }
      }

      setServerIds(next);
      try {
        const response = await fetch(
          `/api/share/${encodeURIComponent(slug)}/favorites/${encodeURIComponent(photoId)}`,
          { method: isFav ? "DELETE" : "PUT" },
        );

        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as { error?: string } | null;
          setServerIds(ids);
          setError(body?.error ?? "Unable to update favorite.");
          return false;
        }

        const data = (await response.json()) as FavoritesResponse;
        setServerIds(data.photoIds);
        return true;
      } catch {
        setServerIds(ids);
        setError("Unable to update favorite. Please try again.");
        return false;
      }
    },
    [ids, mode, slug],
  );

  return { favoriteIds, favoriteList: ids, toggleFavorite, error };
}
