"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import type { Photo } from "@/contracts/album";
import type { CreateShareResponse, ShareMode } from "@/contracts/share";
import { listAlbumPhotosAction } from "@/app/admin/albums/actions";
import { createShareAction } from "@/app/admin/shares/actions";
import {
  Alert,
  Breadcrumbs,
  Button,
  Checkbox,
  EmptyState,
  Field,
  Fieldset,
  Input,
  RadioGroup,
  Select,
  Switch,
  Textarea,
} from "@/components/ui";
import { BrandMark } from "@/components/brand-mark";

import {
  validateAndBuildShareInput,
  type ExpiryChoice,
  type MetadataPolicyChoice,
  type PhotoSubsetChoice,
  type ShareComposerErrors,
} from "./share-composer";
import { SharePhotoPicker } from "./share-photo-picker";

export interface ShareComposerAlbumOption {
  id: string;
  title: string;
  slug: string;
  photoCount: number;
}

export interface NewShareFormProps {
  albums: ShareComposerAlbumOption[];
  initialAlbumId: string | null;
  orgDefaults: {
    name: string;
    title: string | null;
    logo: string | null;
    accent: string | null;
    stripMetadata: boolean;
  };
  /** YYYY-MM-DD computed on the server so SSR and hydration match. */
  todayDate: string;
}

export function NewShareForm({
  albums,
  initialAlbumId,
  orgDefaults,
  todayDate,
}: NewShareFormProps) {
  const router = useRouter();
  const initialAlbum =
    (initialAlbumId ? albums.find((album) => album.id === initialAlbumId) : null) ?? null;

  const [albumId, setAlbumId] = useState(initialAlbum?.id ?? albums[0]?.id ?? "");
  const [mode, setMode] = useState<ShareMode>("public");
  const [password, setPassword] = useState("");
  const [recipientsText, setRecipientsText] = useState("");
  const [expiryChoice, setExpiryChoice] = useState<ExpiryChoice>("never");
  const [expiryDate, setExpiryDate] = useState(todayDate);
  const [allowDownload, setAllowDownload] = useState(true);
  const [allowOriginal, setAllowOriginal] = useState(true);
  const [allowWeb, setAllowWeb] = useState(true);
  const [photoScope, setPhotoScope] = useState<PhotoSubsetChoice>("whole");
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);
  const [albumPhotosState, setAlbumPhotosState] = useState<{
    albumId: string | null;
    photos: Photo[];
    error: string | null;
  }>({
    albumId: null,
    photos: [],
    error: null,
  });
  const [photosReloadTick, setPhotosReloadTick] = useState(0);
  const [metadataPolicy, setMetadataPolicy] = useState<MetadataPolicyChoice>("inherit");
  const [brandingTitle, setBrandingTitle] = useState("");
  const [brandingLogo, setBrandingLogo] = useState("");
  const [brandingAccent, setBrandingAccent] = useState("");
  const [brandingWelcomeMessage, setBrandingWelcomeMessage] = useState("");

  const [errors, setErrors] = useState<ShareComposerErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [createdResult, setCreatedResult] = useState<CreateShareResponse | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!albumId) {
      return;
    }

    let cancelled = false;
    void (async () => {
      const result = await listAlbumPhotosAction(albumId);
      if (cancelled) {
        return;
      }
      if (!result.ok) {
        setAlbumPhotosState({ albumId, photos: [], error: result.error });
        return;
      }
      setAlbumPhotosState({ albumId, photos: result.data.photos, error: null });
    })();

    return () => {
      cancelled = true;
    };
  }, [albumId, photosReloadTick]);

  const photosLoading = Boolean(albumId) && albumPhotosState.albumId !== albumId;
  const albumPhotos = albumPhotosState.albumId === albumId ? albumPhotosState.photos : [];
  const photosError = albumPhotosState.albumId === albumId ? albumPhotosState.error : null;

  if (albums.length === 0) {
    return (
      <section className="admin-page" aria-labelledby="new-share-heading">
        <Breadcrumbs
          items={[
            { label: "Shares", href: "/admin/shares" },
            { label: "New share" },
          ]}
        />
        <header className="admin-page-header">
          <div>
            <h1 id="new-share-heading">New share</h1>
            <p className="auth-lede">Create a client link from any indexed album.</p>
          </div>
        </header>
        <EmptyState
          title="No albums to share yet"
          description="Create and index an album from Google Drive before composing a share link."
          action={
            <Link href="/admin/albums/new" className="ui-btn ui-btn-primary ui-btn-sm">
              <span className="ui-btn-label">New album</span>
            </Link>
          }
        />
      </section>
    );
  }

  const selectedAlbum = albums.find((album) => album.id === albumId) ?? albums[0];
  const cancelHref = initialAlbum
    ? `/admin/albums/${encodeURIComponent(initialAlbum.id)}`
    : "/admin/shares";

  const showMetadataWarning =
    metadataPolicy === "keep" || (metadataPolicy === "inherit" && !orgDefaults.stripMetadata);

  const handleCopy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      setSubmitError("Clipboard access was blocked by this browser.");
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) {
      return;
    }

    const validated = validateAndBuildShareInput({
      albumId,
      mode,
      password,
      recipientsText,
      expiryChoice,
      expiryDate,
      allowDownload,
      allowOriginal,
      allowWeb,
      photoScope,
      selectedPhotoIds,
      metadataPolicy,
      brandingTitle,
      brandingLogo,
      brandingAccent,
      brandingWelcomeMessage,
    });

    if (!validated.ok) {
      setErrors(validated.errors);
      setSubmitError(null);
      return;
    }

    setErrors({});
    setSubmitError(null);
    setSubmitting(true);

    const result = await createShareAction(validated.albumId, validated.input);
    setSubmitting(false);

    if (!result.ok) {
      setSubmitError(result.error);
      return;
    }

    setCreatedResult(result.data);
    router.refresh();
  };

  if (createdResult) {
    const sharePath = `/s/${createdResult.share.slug}`;
    const shareUrl =
      typeof window === "undefined" ? sharePath : `${window.location.origin}${sharePath}`;
    const hasMagicLinks = createdResult.links.length > 0;
    const subsetLabel =
      createdResult.share.photoCount !== null
        ? `Frozen subset (${createdResult.share.photoCount} ${
            createdResult.share.photoCount === 1 ? "photo" : "photos"
          })`
        : "Whole album (follows re-indexing)";

    return (
      <section className="admin-page" aria-labelledby="new-share-heading">
        <Breadcrumbs
          items={[
            { label: "Albums", href: "/admin/albums" },
            {
              label: selectedAlbum.title,
              href: `/admin/albums/${encodeURIComponent(selectedAlbum.id)}`,
            },
            { label: "Share created" },
          ]}
        />

        <header className="admin-page-header">
          <div>
            <h1 id="new-share-heading">
              {hasMagicLinks ? "Magic links issued" : "Share created"}
            </h1>
            <p className="auth-lede">
              {hasMagicLinks
                ? "Copy and send these one-time links now. Raw tokens cannot be viewed again after leaving this page."
                : "The gallery link is ready. You can adjust its settings or photo subset at any time."}
            </p>
          </div>
          <div className="specimen-inline-cluster">
            <Link
              href={`/admin/shares/${encodeURIComponent(createdResult.share.id)}`}
              className="ui-btn ui-btn-primary ui-btn-md"
            >
              <span className="ui-btn-label">Manage share</span>
            </Link>
            <Link
              href={`/admin/albums/${encodeURIComponent(createdResult.share.albumId)}`}
              className="ui-btn ui-btn-secondary ui-btn-md"
            >
              <span className="ui-btn-label">Back to album</span>
            </Link>
            <Link href="/admin/shares" className="ui-btn ui-btn-ghost ui-btn-md">
              <span className="ui-btn-label">All shares</span>
            </Link>
          </div>
        </header>

        {submitError && (
          <Alert tone="danger" title="Copy failed" onDismiss={() => setSubmitError(null)}>
            {submitError}
          </Alert>
        )}

        <Alert tone="success" title={`Share /s/${createdResult.share.slug} is ready`}>
          <div className="admin-dialog-stack">
            <div className="specimen-inline-cluster">
              <span>Gallery URL:</span>
              <code>{sharePath}</code>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void handleCopy("share-url", shareUrl)}
              >
                {copiedKey === "share-url" ? "Copied" : "Copy link"}
              </Button>
            </div>
            <div>
              <span>Included photos: </span>
              <strong>{subsetLabel}</strong>
            </div>
          </div>
        </Alert>

        {hasMagicLinks && (
          <Fieldset
            legend="Recipient magic links"
            description="Each recipient link is valid for a single sign-in exchange."
          >
            <div className="admin-folder-list">
              {createdResult.links.map((link) => (
                <div key={link.recipientId} className="admin-folder-row">
                  <div className="admin-table-primary">
                    <strong>{link.email}</strong>
                    <code className="admin-table-sub">{link.url}</code>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void handleCopy(link.recipientId, link.url)}
                  >
                    {copiedKey === link.recipientId ? "Copied" : "Copy link"}
                  </Button>
                </div>
              ))}
            </div>
          </Fieldset>
        )}
      </section>
    );
  }

  return (
    <section className="admin-page" aria-labelledby="new-share-heading">
      <Breadcrumbs
        items={
          initialAlbum
            ? [
                { label: "Albums", href: "/admin/albums" },
                {
                  label: initialAlbum.title,
                  href: `/admin/albums/${encodeURIComponent(initialAlbum.id)}`,
                },
                { label: "New share" },
              ]
            : [
                { label: "Shares", href: "/admin/shares" },
                { label: "New share" },
              ]
        }
      />

      <header className="admin-page-header">
        <div>
          <h1 id="new-share-heading">New share</h1>
          <p className="auth-lede">
            Configure client access, expiry, download qualities, branding, and metadata policy.
          </p>
        </div>

        <div className="specimen-inline-cluster">
          <Link href={cancelHref} className="ui-btn ui-btn-ghost ui-btn-md">
            <span className="ui-btn-label">Cancel</span>
          </Link>
          <Button type="submit" form="new-share-form" variant="primary" loading={submitting}>
            Create share
          </Button>
        </div>
      </header>

      {submitError && (
        <Alert tone="danger" title="Could not create share" onDismiss={() => setSubmitError(null)}>
          {submitError}
        </Alert>
      )}

      <form id="new-share-form" onSubmit={handleSubmit} className="admin-settings-sections" noValidate>
        <Fieldset
          legend="1 · Album & access"
          description="Choose which album to publish and how guests unlock the folio."
        >
          <Field htmlFor="share-album" label="Album" error={errors.albumId}>
            <Select
              id="share-album"
              value={albumId}
              disabled={submitting}
              invalid={Boolean(errors.albumId)}
              onChange={(event) => {
                setAlbumId(event.target.value);
                setPhotoScope("whole");
                setSelectedPhotoIds([]);
                setErrors((prev) => ({
                  ...prev,
                  albumId: undefined,
                  photoIds: undefined,
                }));
              }}
              options={albums.map((album) => ({
                value: album.id,
                label: `${album.title} (${album.photoCount} photos)`,
              }))}
            />
          </Field>

          <RadioGroup
            name="share-mode"
            legend="Access mode"
            value={mode}
            disabled={submitting}
            onChange={(value) => {
              setMode(value as ShareMode);
              setErrors((prev) => ({ ...prev, password: undefined, recipients: undefined }));
            }}
            options={[
              {
                value: "public",
                label: "Public link",
                description: "Anyone with the link can view the folio.",
              },
              {
                value: "password",
                label: "Password protected",
                description: "Guests enter a shared passphrase before viewing.",
              },
              {
                value: "magic_link",
                label: "One-time magic link",
                description: "Issue personal sign-in links for invited email recipients.",
              },
            ]}
          />

          {mode === "password" && (
            <Field
              htmlFor="share-password"
              label="Share password"
              hint="Minimum 8 characters. The password is hashed and cannot be retrieved later."
              error={errors.password}
            >
              <Input
                id="share-password"
                type="password"
                value={password}
                disabled={submitting}
                invalid={Boolean(errors.password)}
                placeholder="At least 8 characters"
                onChange={(event) => {
                  setPassword(event.target.value);
                  setErrors((prev) => ({ ...prev, password: undefined }));
                }}
              />
            </Field>
          )}

          {mode === "magic_link" && (
            <Field
              htmlFor="share-recipients"
              label="Recipients"
              optionalLabel="Optional"
              hint="Comma or newline separated emails. Each gets a one-time link immediately after creation."
              error={errors.recipients}
            >
              <Textarea
                id="share-recipients"
                rows={3}
                value={recipientsText}
                disabled={submitting}
                invalid={Boolean(errors.recipients)}
                placeholder="client@example.com, partner@example.com"
                onChange={(event) => {
                  setRecipientsText(event.target.value);
                  setErrors((prev) => ({ ...prev, recipients: undefined }));
                }}
              />
            </Field>
          )}
        </Fieldset>

        <Fieldset
          legend="2 · Expiry & downloads"
          description="Set when the link stops working and which file sizes guests may save."
        >
          <RadioGroup
            name="share-expiry"
            legend="Link expiration"
            value={expiryChoice}
            disabled={submitting}
            onChange={(value) => {
              setExpiryChoice(value as ExpiryChoice);
              setErrors((prev) => ({ ...prev, expiryDate: undefined }));
            }}
            options={[
              { value: "never", label: "Never expires" },
              {
                value: "date",
                label: "Expire on a specific date",
                description: "Access stops at the end of the chosen UTC day.",
              },
            ]}
          />

          {expiryChoice === "date" && (
            <Field
              htmlFor="share-expiry-date"
              label="Expiration date"
              error={errors.expiryDate}
            >
              <Input
                id="share-expiry-date"
                type="date"
                min={todayDate}
                value={expiryDate}
                disabled={submitting}
                invalid={Boolean(errors.expiryDate)}
                onChange={(event) => {
                  setExpiryDate(event.target.value);
                  setErrors((prev) => ({ ...prev, expiryDate: undefined }));
                }}
              />
            </Field>
          )}

          <Switch
            id="share-allow-download"
            checked={allowDownload}
            disabled={submitting}
            onChange={(nextChecked) => {
              setAllowDownload(nextChecked);
              setErrors((prev) => ({ ...prev, qualities: undefined }));
            }}
            label="Allow photo and ZIP downloads"
            description="When disabled, guests can still view and favorite photos in the gallery."
          />

          {allowDownload && (
            <div className="admin-dialog-stack">
              <Checkbox
                id="share-quality-original"
                checked={allowOriginal}
                disabled={submitting}
                invalid={Boolean(errors.qualities)}
                onChange={(event) => {
                  setAllowOriginal(event.target.checked);
                  setErrors((prev) => ({ ...prev, qualities: undefined }));
                }}
                label="Original"
                description="Full-resolution files streamed directly from Google Drive."
              />
              <Checkbox
                id="share-quality-web"
                checked={allowWeb}
                disabled={submitting}
                invalid={Boolean(errors.qualities)}
                onChange={(event) => {
                  setAllowWeb(event.target.checked);
                  setErrors((prev) => ({ ...prev, qualities: undefined }));
                }}
                label="Web 2048"
                description="Optimized 2048px JPEG copies for quick sharing."
              />
              {errors.qualities && (
                <p className="ui-field-error" role="alert">
                  <span>{errors.qualities}</span>
                </p>
              )}
            </div>
          )}
        </Fieldset>

        <Fieldset
          legend="3 · Photo subset"
          description="Follow the entire album or freeze this share to specific indexed photos."
        >
          <RadioGroup
            name="share-subset"
            legend="Included photos"
            value={photoScope}
            disabled={submitting}
            onChange={(value) => {
              setPhotoScope(value as PhotoSubsetChoice);
              setErrors((prev) => ({ ...prev, photoIds: undefined }));
            }}
            options={[
              {
                value: "whole",
                label: "Whole album",
                description: `Includes all ${selectedAlbum.photoCount} photos and picks up new photos after a re-index.`,
              },
              {
                value: "frozen",
                label: "Frozen subset",
                description:
                  albumPhotos.length > 0
                    ? `${selectedPhotoIds.length} selected out of ${albumPhotos.length}. New album uploads stay excluded.`
                    : "Choose individual indexed photos; new album uploads stay excluded.",
              },
            ]}
          />

          {photoScope === "frozen" && (
            <div className="admin-dialog-stack">
              {errors.photoIds && (
                <Alert tone="danger" title="Select photos for frozen subset">
                  {errors.photoIds}
                </Alert>
              )}

              <SharePhotoPicker
                albumId={albumId}
                photos={albumPhotos}
                loading={photosLoading}
                error={photosError}
                onRetry={() => {
                  setAlbumPhotosState({ albumId: null, photos: [], error: null });
                  setPhotosReloadTick((tick) => tick + 1);
                }}
                selectedPhotoIds={selectedPhotoIds}
                onChangeSelected={(nextIds) => {
                  setSelectedPhotoIds(nextIds);
                  setErrors((prev) => ({ ...prev, photoIds: undefined }));
                }}
                disabled={submitting}
              />
            </div>
          )}
        </Fieldset>

        <Fieldset
          legend="4 · Branding override"
          description={`Leave blank to inherit organization defaults (${orgDefaults.title || orgDefaults.name}).`}
        >
          <div className="specimen-form-grid">
            <Field
              htmlFor="share-branding-title"
              label="Gallery title override"
              optionalLabel="Optional"
              error={errors.brandingTitle}
            >
              <Input
                id="share-branding-title"
                value={brandingTitle}
                maxLength={120}
                disabled={submitting}
                invalid={Boolean(errors.brandingTitle)}
                placeholder={orgDefaults.title || orgDefaults.name}
                onChange={(event) => {
                  setBrandingTitle(event.target.value);
                  setErrors((prev) => ({ ...prev, brandingTitle: undefined }));
                }}
              />
            </Field>

            <Field
              htmlFor="share-branding-logo"
              label="Logo URL override"
              optionalLabel="Optional"
              hint={orgDefaults.logo ? "Leave blank to inherit the organization logo." : "Leave blank to use the title initial."}
              error={errors.brandingLogo}
            >
              <div className="brand-preview-row">
                <BrandMark
                  title={brandingTitle || orgDefaults.title || orgDefaults.name}
                  logo={brandingLogo || orgDefaults.logo}
                />
                <Input
                  id="share-branding-logo"
                  value={brandingLogo}
                  maxLength={2000}
                  disabled={submitting}
                  invalid={Boolean(errors.brandingLogo)}
                  placeholder={orgDefaults.logo ?? "https://example.com/logo.png"}
                  onChange={(event) => {
                    setBrandingLogo(event.target.value);
                    setErrors((prev) => ({ ...prev, brandingLogo: undefined }));
                  }}
                />
              </div>
            </Field>

            <Field
              htmlFor="share-branding-accent"
              label="Accent hex color"
              optionalLabel="Optional"
              hint={orgDefaults.accent ? `Organization default: ${orgDefaults.accent}` : "Format: #rrggbb"}
              error={errors.brandingAccent}
            >
              <Input
                id="share-branding-accent"
                value={brandingAccent}
                maxLength={7}
                disabled={submitting}
                invalid={Boolean(errors.brandingAccent)}
                placeholder={orgDefaults.accent ?? "#b4532a"}
                onChange={(event) => {
                  setBrandingAccent(event.target.value);
                  setErrors((prev) => ({ ...prev, brandingAccent: undefined }));
                }}
              />
            </Field>
          </div>

          <Field
            htmlFor="share-branding-welcome"
            label="Welcome message"
            optionalLabel="Optional"
            hint="Shown in the client folio introduction when set."
            error={errors.brandingWelcomeMessage}
          >
            <Textarea
              id="share-branding-welcome"
              rows={3}
              value={brandingWelcomeMessage}
              maxLength={500}
              currentLength={brandingWelcomeMessage.length}
              disabled={submitting}
              invalid={Boolean(errors.brandingWelcomeMessage)}
              placeholder="Write a brief note for guests opening this gallery…"
              onChange={(event) => {
                setBrandingWelcomeMessage(event.target.value);
                setErrors((prev) => ({ ...prev, brandingWelcomeMessage: undefined }));
              }}
            />
          </Field>
        </Fieldset>

        <Fieldset
          legend="5 · Metadata policy"
          description="Control whether thumbnails and Web 2048 copies keep camera EXIF and GPS. Original downloads always keep the file's metadata and are never rewritten."
        >
          <RadioGroup
            name="share-metadata-policy"
            legend="Thumbnail & web copy metadata"
            value={metadataPolicy}
            disabled={submitting}
            onChange={(value) => setMetadataPolicy(value as MetadataPolicyChoice)}
            options={[
              {
                value: "inherit",
                label: "Inherit organization policy",
                description: `Currently ${
                  orgDefaults.stripMetadata
                    ? "strips EXIF & GPS from thumbnails and web copies"
                    : "keeps EXIF & GPS in thumbnails and web copies"
                }.`,
              },
              {
                value: "strip",
                label: "Strip EXIF & GPS",
                description:
                  "Removes EXIF, XMP, IPTC, and GPS from thumbnails and Web 2048 copies.",
              },
              {
                value: "keep",
                label: "Keep EXIF & GPS",
                description: "Sends thumbnail and web-copy metadata as-is.",
              },
            ]}
          />

          {showMetadataWarning && (
            <Alert tone="warning" title="Location and camera metadata will be exposed">
              Thumbnails and Web 2048 copies on this share will retain original GPS
              coordinates and camera EXIF. Original downloads are never rewritten, so they
              always keep their metadata.
            </Alert>
          )}
        </Fieldset>
      </form>
    </section>
  );
}
