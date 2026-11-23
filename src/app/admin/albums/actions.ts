"use server";

import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/contracts/actions";
import type {
  AlbumDetailResponse,
  CreateAlbumInput,
  SetAlbumCoverInput,
  UpdateAlbumInput,
} from "@/contracts/admin";
import type { AlbumPhotosResponse, AlbumSummary, ReorderAlbumPhotosInput } from "@/contracts/album";
import { getAdminSession } from "@/server/auth/api";
import { AlbumValidationError } from "@/server/albums/service";
import { getAlbumService } from "@/server/albums/runtime";
import {
  albumIdSchema,
  createAlbumSchema,
  reorderAlbumPhotosSchema,
  setAlbumCoverSchema,
  updateAlbumSchema,
} from "@/server/albums/validation";

const UNAUTHORIZED: ActionResult<never> = {
  ok: false,
  error: "Unauthorized.",
  code: "unauthorized",
};

function notFound(message: string): ActionResult<never> {
  return { ok: false, error: message, code: "not_found" };
}

function failed(error: unknown): ActionResult<never> {
  if (error instanceof AlbumValidationError) {
    return { ok: false, error: error.message, code: "validation" };
  }
  console.error("[admin] album action failed:", error);
  return { ok: false, error: "Something went wrong. Try again.", code: "internal" };
}

function refreshAlbumPages(albumId: string): void {
  revalidatePath("/admin/albums");
  revalidatePath(`/admin/albums/${albumId}`);
}

async function adminUserId(): Promise<string | null> {
  const session = await getAdminSession();
  return session?.user.id ?? null;
}

export async function createAlbumAction(
  input: CreateAlbumInput,
): Promise<ActionResult<AlbumSummary>> {
  const userId = await adminUserId();
  if (!userId) {
    return UNAUTHORIZED;
  }

  const parsed = createAlbumSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Check the album and try again.",
      code: "validation",
    };
  }

  try {
    const album = await getAlbumService().create(userId, parsed.data);
    revalidatePath("/admin");
    revalidatePath("/admin/albums");
    return { ok: true, data: album };
  } catch (error) {
    return failed(error);
  }
}

export async function reindexAlbumAction(
  albumId: string,
  mode: "full" | "incremental" = "full",
): Promise<ActionResult<{ albumId: string }>> {
  const userId = await adminUserId();
  if (!userId) {
    return UNAUTHORIZED;
  }

  const parsed = albumIdSchema.safeParse(albumId);
  if (!parsed.success) {
    return notFound("Album not found.");
  }

  try {
    const queued = await getAlbumService().reindex(userId, parsed.data, mode);
    if (!queued) {
      return notFound("Album not found.");
    }
    revalidatePath("/admin");
    refreshAlbumPages(parsed.data);
    return { ok: true, data: { albumId: parsed.data } };
  } catch (error) {
    return failed(error);
  }
}

export async function reorderAlbumPhotosAction(
  albumId: string,
  input: ReorderAlbumPhotosInput,
): Promise<ActionResult<AlbumPhotosResponse>> {
  const userId = await adminUserId();
  if (!userId) {
    return UNAUTHORIZED;
  }

  const parsedId = albumIdSchema.safeParse(albumId);
  if (!parsedId.success) {
    return notFound("Album not found.");
  }

  const parsed = reorderAlbumPhotosSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Check the photo order.",
      code: "validation",
    };
  }

  try {
    const result = await getAlbumService().reorderPhotos(
      userId,
      parsedId.data,
      parsed.data.photoIds,
    );
    if (!result) {
      return notFound("Album not found.");
    }
    refreshAlbumPages(parsedId.data);
    return { ok: true, data: result };
  } catch (error) {
    return failed(error);
  }
}

export async function updateAlbumAction(
  albumId: string,
  input: UpdateAlbumInput,
): Promise<ActionResult<AlbumDetailResponse>> {
  const userId = await adminUserId();
  if (!userId) {
    return UNAUTHORIZED;
  }

  const parsedId = albumIdSchema.safeParse(albumId);
  if (!parsedId.success) {
    return notFound("Album not found.");
  }

  const parsed = updateAlbumSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Check the album and try again.",
      code: "validation",
    };
  }

  try {
    const album = await getAlbumService().update(userId, parsedId.data, parsed.data);
    if (!album) {
      return notFound("Album not found.");
    }
    refreshAlbumPages(parsedId.data);
    return { ok: true, data: { album } };
  } catch (error) {
    return failed(error);
  }
}

export async function deleteAlbumAction(
  albumId: string,
): Promise<ActionResult<{ albumId: string }>> {
  const userId = await adminUserId();
  if (!userId) {
    return UNAUTHORIZED;
  }

  const parsed = albumIdSchema.safeParse(albumId);
  if (!parsed.success) {
    return notFound("Album not found.");
  }

  try {
    const removed = await getAlbumService().remove(userId, parsed.data);
    if (!removed) {
      return notFound("Album not found.");
    }
    revalidatePath("/admin/albums");
    return { ok: true, data: { albumId: parsed.data } };
  } catch (error) {
    return failed(error);
  }
}

export async function setAlbumCoverAction(
  albumId: string,
  input: SetAlbumCoverInput,
): Promise<ActionResult<AlbumDetailResponse>> {
  const userId = await adminUserId();
  if (!userId) {
    return UNAUTHORIZED;
  }

  const parsedId = albumIdSchema.safeParse(albumId);
  if (!parsedId.success) {
    return notFound("Album not found.");
  }

  const parsed = setAlbumCoverSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Choose a photo from this album.",
      code: "validation",
    };
  }

  try {
    const album = await getAlbumService().setCover(userId, parsedId.data, parsed.data.photoId);
    if (!album) {
      return notFound("Album not found.");
    }
    refreshAlbumPages(parsedId.data);
    return { ok: true, data: { album } };
  } catch (error) {
    return failed(error);
  }
}
