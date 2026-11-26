"use server";

import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/contracts/actions";
import type {
  CreateShareInput,
  CreateShareResponse,
  IssuedMagicLink,
  ShareDetailResponse,
  ShareListResponse,
  UpdateShareInput,
} from "@/contracts/share";
import { getAdminSession } from "@/server/auth/api";
import { ShareNotFoundError, ShareValidationError } from "@/server/shares/admin";
import { getShareAdminService } from "@/server/shares/runtime";
import {
  albumIdSchema,
  createShareSchema,
  emailSchema,
  recipientIdSchema,
  shareIdSchema,
  sharePhotoIdsSchema,
  updateShareSchema,
} from "@/server/shares/validation";

const UNAUTHORIZED: ActionResult<never> = {
  ok: false,
  error: "Unauthorized.",
  code: "unauthorized",
};

function invalid(message: string): ActionResult<never> {
  return { ok: false, error: message, code: "validation" };
}

function notFound(message: string): ActionResult<never> {
  return { ok: false, error: message, code: "not_found" };
}

function failed(error: unknown): ActionResult<never> {
  if (error instanceof ShareValidationError) {
    return invalid(error.message);
  }
  if (error instanceof ShareNotFoundError) {
    return notFound(error.message);
  }
  console.error("[admin] share action failed:", error);
  return { ok: false, error: "Something went wrong. Try again.", code: "internal" };
}

function refreshAlbumPages(shareId?: string): void {
  revalidatePath("/admin/albums");
  revalidatePath("/admin/shares");
  revalidatePath("/admin");
  if (shareId) {
    revalidatePath(`/admin/shares/${shareId}`);
  }
}

async function adminUserId(): Promise<string | null> {
  const session = await getAdminSession();
  return session?.user.id ?? null;
}

export async function listAlbumSharesAction(
  albumId: string,
): Promise<ActionResult<ShareListResponse>> {
  const userId = await adminUserId();
  if (!userId) {
    return UNAUTHORIZED;
  }

  const parsed = albumIdSchema.safeParse(albumId);
  if (!parsed.success) {
    return notFound("Album not found.");
  }

  try {
    const shares = await getShareAdminService().list(userId, parsed.data);
    return { ok: true, data: { shares } };
  } catch (error) {
    return failed(error);
  }
}

export async function createShareAction(
  albumId: string,
  input: CreateShareInput,
): Promise<ActionResult<CreateShareResponse>> {
  const userId = await adminUserId();
  if (!userId) {
    return UNAUTHORIZED;
  }

  const parsedAlbum = albumIdSchema.safeParse(albumId);
  if (!parsedAlbum.success) {
    return notFound("Album not found.");
  }

  const parsed = createShareSchema.safeParse(input);
  if (!parsed.success) {
    return invalid(parsed.error.issues[0]?.message ?? "Invalid share input.");
  }

  try {
    const result = await getShareAdminService().create(userId, parsedAlbum.data, parsed.data);
    refreshAlbumPages();
    return { ok: true, data: { share: result.share, links: result.links } };
  } catch (error) {
    return failed(error);
  }
}

export async function updateShareAction(
  shareId: string,
  input: UpdateShareInput,
): Promise<ActionResult<ShareDetailResponse>> {
  const userId = await adminUserId();
  if (!userId) {
    return UNAUTHORIZED;
  }

  const parsedId = shareIdSchema.safeParse(shareId);
  if (!parsedId.success) {
    return notFound("Share not found.");
  }

  const parsed = updateShareSchema.safeParse(input);
  if (!parsed.success) {
    return invalid(parsed.error.issues[0]?.message ?? "Invalid share input.");
  }

  try {
    const share = await getShareAdminService().update(userId, parsedId.data, parsed.data);
    refreshAlbumPages(parsedId.data);
    return { ok: true, data: { share } };
  } catch (error) {
    return failed(error);
  }
}

export async function deleteShareAction(
  shareId: string,
): Promise<ActionResult<{ shareId: string }>> {
  const userId = await adminUserId();
  if (!userId) {
    return UNAUTHORIZED;
  }

  const parsed = shareIdSchema.safeParse(shareId);
  if (!parsed.success) {
    return notFound("Share not found.");
  }

  try {
    const removed = await getShareAdminService().remove(userId, parsed.data);
    if (!removed) {
      return notFound("Share not found.");
    }
    refreshAlbumPages(parsed.data);
    return { ok: true, data: { shareId: parsed.data } };
  } catch (error) {
    return failed(error);
  }
}

export async function setSharePhotosAction(
  shareId: string,
  photoIds: string[] | null,
): Promise<ActionResult<ShareDetailResponse>> {
  const userId = await adminUserId();
  if (!userId) {
    return UNAUTHORIZED;
  }

  const parsedId = shareIdSchema.safeParse(shareId);
  if (!parsedId.success) {
    return notFound("Share not found.");
  }

  const parsedPhotos = sharePhotoIdsSchema.safeParse(photoIds);
  if (!parsedPhotos.success) {
    return invalid("Photo ids must be valid UUIDs.");
  }

  try {
    const share = await getShareAdminService().setPhotos(
      userId,
      parsedId.data,
      parsedPhotos.data,
    );
    refreshAlbumPages(parsedId.data);
    return { ok: true, data: { share } };
  } catch (error) {
    return failed(error);
  }
}

export async function addShareRecipientAction(
  shareId: string,
  email: string,
): Promise<ActionResult<IssuedMagicLink>> {
  const userId = await adminUserId();
  if (!userId) {
    return UNAUTHORIZED;
  }

  const parsedId = shareIdSchema.safeParse(shareId);
  if (!parsedId.success) {
    return notFound("Share not found.");
  }

  const parsedEmail = emailSchema.safeParse(email);
  if (!parsedEmail.success) {
    return invalid(parsedEmail.error.issues[0]?.message ?? "Enter a valid email.");
  }

  try {
    const link = await getShareAdminService().addRecipient(
      userId,
      parsedId.data,
      parsedEmail.data,
    );
    refreshAlbumPages(parsedId.data);
    return { ok: true, data: link };
  } catch (error) {
    return failed(error);
  }
}

export async function removeShareRecipientAction(
  shareId: string,
  recipientId: string,
): Promise<ActionResult<{ recipientId: string }>> {
  const userId = await adminUserId();
  if (!userId) {
    return UNAUTHORIZED;
  }

  const parsedShare = shareIdSchema.safeParse(shareId);
  const parsedRecipient = recipientIdSchema.safeParse(recipientId);
  if (!parsedShare.success) {
    return notFound("Share not found.");
  }
  if (!parsedRecipient.success) {
    return notFound("Recipient not found.");
  }

  try {
    const removed = await getShareAdminService().removeRecipient(
      userId,
      parsedShare.data,
      parsedRecipient.data,
    );
    if (!removed) {
      return notFound("Share not found.");
    }
    refreshAlbumPages(parsedShare.data);
    return { ok: true, data: { recipientId: parsedRecipient.data } };
  } catch (error) {
    return failed(error);
  }
}

export async function reissueMagicLinkAction(
  shareId: string,
  recipientId: string,
): Promise<ActionResult<IssuedMagicLink>> {
  const userId = await adminUserId();
  if (!userId) {
    return UNAUTHORIZED;
  }

  const parsedShare = shareIdSchema.safeParse(shareId);
  const parsedRecipient = recipientIdSchema.safeParse(recipientId);
  if (!parsedShare.success) {
    return notFound("Share not found.");
  }
  if (!parsedRecipient.success) {
    return notFound("Recipient not found.");
  }

  try {
    const link = await getShareAdminService().reissueMagicLink(
      userId,
      parsedShare.data,
      parsedRecipient.data,
    );
    refreshAlbumPages(parsedShare.data);
    return { ok: true, data: link };
  } catch (error) {
    return failed(error);
  }
}
