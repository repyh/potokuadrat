"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import type { Photo } from "@/contracts/album";
import type { BrandingOverride } from "@/contracts/branding";
import type {
  DownloadQuality,
  IssuedMagicLink,
  ShareDetail,
  ShareMode,
  ShareRecipientSummary,
} from "@/contracts/share";
import {
  addShareRecipientAction,
  reissueMagicLinkAction,
  removeShareRecipientAction,
  setSharePhotosAction,
  updateShareAction,
} from "@/app/admin/shares/actions";
import {
  Alert,
  Breadcrumbs,
  Button,
  Checkbox,
  DataTable,
  EmptyState,
  Field,
  Fieldset,
  Input,
  RadioGroup,
  Switch,
  Textarea,
} from "@/components/ui";
import { BrandMark } from "@/components/brand-mark";

import { formatCount, formatDay, formatRelative } from "./format";
import { ShareRevokeDialog } from "./share-revoke-dialog";

export interface ShareDetailViewProps {
  share: ShareDetail;
  albumTitle: string;
  albumSlug: string;
  albumPhotos: Photo[];
  orgDefaults: {
    name: string;
    title: string | null;
    logo: string | null;
    accent: string | null;
    stripMetadata: boolean;
  };
  /** Server timestamp so expiry and relative dates match between SSR and hydration. */
  now: number;
  todayDate: string;
}

const MODE_LABELS: Record<ShareMode, string> = {
  public: "Public",
  password: "Password",
  magic_link: "Magic link",
};

type MetadataChoice = "inherit" | "strip" | "keep";
const SUBSET_INITIAL_COUNT = 12;

function toDateInputValue(iso: string | null, fallbackDate: string): string {
  if (!iso) {
    return fallbackDate;
  }
  return iso.slice(0, 10);
}

function recipientStatus(recipient: ShareRecipientSummary, now: number): string {
  if (recipient.usedAt) {
    return `Used ${formatDay(recipient.usedAt)}`;
  }
  if (recipient.expiresAt && new Date(recipient.expiresAt).getTime() <= now) {
    return `Expired ${formatDay(recipient.expiresAt)}`;
  }
  return recipient.expiresAt ? `Pending · expires ${formatDay(recipient.expiresAt)}` : "Pending";
}

export function ShareDetailView({
  share: initialShare,
  albumTitle,
  albumSlug,
  albumPhotos,
  orgDefaults,
  now,
  todayDate,
}: ShareDetailViewProps) {
  const router = useRouter();
  const [share, setShare] = useState<ShareDetail>(initialShare);

  const [mode, setMode] = useState<ShareMode>(initialShare.mode);
  const [password, setPassword] = useState("");
  const [expiryChoice, setExpiryChoice] = useState<"never" | "date">(
    initialShare.expiresAt ? "date" : "never",
  );
  const [expiryDate, setExpiryDate] = useState(() =>
    toDateInputValue(initialShare.expiresAt, todayDate),
  );
  const [allowDownload, setAllowDownload] = useState(initialShare.allowDownload);
  const [allowOriginal, setAllowOriginal] = useState(
    initialShare.allowedQualities.includes("original"),
  );
  const [allowWeb, setAllowWeb] = useState(initialShare.allowedQualities.includes("web"));
  const [savingAccess, setSavingAccess] = useState(false);

  const [newRecipientEmail, setNewRecipientEmail] = useState("");
  const [addingRecipient, setAddingRecipient] = useState(false);
  const [busyRecipientId, setBusyRecipientId] = useState<string | null>(null);
  const [issuedLinks, setIssuedLinks] = useState<IssuedMagicLink[]>([]);

  const [subsetChoice, setSubsetChoice] = useState<"whole" | "frozen">(
    initialShare.photoIds ? "frozen" : "whole",
  );
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>(
    () => initialShare.photoIds ?? [],
  );
  const [subsetQuery, setSubsetQuery] = useState("");
  const [subsetVisibleCount, setSubsetVisibleCount] = useState(SUBSET_INITIAL_COUNT);
  const [savingSubset, setSavingSubset] = useState(false);

  const [brandingTitle, setBrandingTitle] = useState(initialShare.branding?.title ?? "");
  const [brandingLogo, setBrandingLogo] = useState(initialShare.branding?.logo ?? "");
  const [brandingAccent, setBrandingAccent] = useState(initialShare.branding?.accent ?? "");
  const [brandingWelcome, setBrandingWelcome] = useState(
    initialShare.branding?.welcomeMessage ?? "",
  );
  const [metadataPolicy, setMetadataPolicy] = useState<MetadataChoice>(
    initialShare.stripMetadata === null
      ? "inherit"
      : initialShare.stripMetadata
        ? "strip"
        : "keep",
  );
  const [savingBranding, setSavingBranding] = useState(false);

  const [revokeOpen, setRevokeOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "danger";
    title: string;
    message: string;
  } | null>(null);

  const sharePath = `/s/${share.slug}`;
  const isExpired = share.expiresAt ? new Date(share.expiresAt).getTime() <= now : false;

  const filteredPhotos = useMemo(() => {
    const needle = subsetQuery.trim().toLowerCase();
    if (!needle) {
      return albumPhotos;
    }
    return albumPhotos.filter((photo) => photo.name.toLowerCase().includes(needle));
  }, [albumPhotos, subsetQuery]);

  const displayedSubsetPhotos = useMemo(
    () => filteredPhotos.slice(0, subsetVisibleCount),
    [filteredPhotos, subsetVisibleCount],
  );

  const selectedSet = useMemo(() => new Set(selectedPhotoIds), [selectedPhotoIds]);

  const showMetadataWarning =
    metadataPolicy === "keep" || (metadataPolicy === "inherit" && !orgDefaults.stripMetadata);

  const handleCopy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      setFeedback({
        tone: "danger",
        title: "Copy failed",
        message: "Clipboard access was blocked by this browser.",
      });
    }
  };

  const handleSaveAccess = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (savingAccess) {
      return;
    }

    const qualities: DownloadQuality[] = [];
    if (allowDownload) {
      if (allowOriginal) {
        qualities.push("original");
      }
      if (allowWeb) {
        qualities.push("web");
      }
      if (qualities.length === 0) {
        setFeedback({
          tone: "danger",
          title: "No download quality selected",
          message: "Keep at least one download quality enabled, or turn downloads off.",
        });
        return;
      }
    }

    if (expiryChoice === "date" && !expiryDate.trim()) {
      setFeedback({
        tone: "danger",
        title: "Choose an expiration date",
        message: "Pick a date, or switch the link to never expire.",
      });
      return;
    }

    if (mode === "password" && share.mode !== "password" && password.trim().length < 8) {
      setFeedback({
        tone: "danger",
        title: "Password required",
        message: "Use at least 8 characters when switching to password mode.",
      });
      return;
    }

    const expiresAt =
      expiryChoice === "date" && expiryDate.trim()
        ? `${expiryDate.trim()}T23:59:59.999Z`
        : null;

    setSavingAccess(true);
    setFeedback(null);
    const result = await updateShareAction(share.id, {
      mode,
      expiresAt,
      allowDownload,
      ...(allowDownload ? { allowedQualities: qualities } : {}),
      ...(mode === "password" && password ? { password } : {}),
    });
    setSavingAccess(false);

    if (!result.ok) {
      setFeedback({ tone: "danger", title: "Could not save access settings", message: result.error });
      return;
    }

    setShare(result.data.share);
    setPassword("");
    setFeedback({
      tone: "success",
      title: "Access & downloads saved",
      message: "Updated link policy immediately.",
    });
    router.refresh();
  };

  const handleAddRecipient = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (addingRecipient) {
      return;
    }

    setAddingRecipient(true);
    setFeedback(null);
    const result = await addShareRecipientAction(share.id, newRecipientEmail);
    setAddingRecipient(false);

    if (!result.ok) {
      setFeedback({ tone: "danger", title: "Could not add recipient", message: result.error });
      return;
    }

    setNewRecipientEmail("");
    setIssuedLinks((prev) => [result.data, ...prev]);
    setShare((prev) => {
      const filtered = prev.recipients.filter((r) => r.email !== result.data.email);
      return {
        ...prev,
        recipients: [
          {
            id: result.data.recipientId,
            email: result.data.email,
            expiresAt: result.data.expiresAt,
            usedAt: null,
            createdAt: new Date(now).toISOString(),
          },
          ...filtered,
        ],
      };
    });
    router.refresh();
  };

  const handleReissue = async (recipientId: string) => {
    if (busyRecipientId) {
      return;
    }
    setBusyRecipientId(recipientId);
    setFeedback(null);
    const result = await reissueMagicLinkAction(share.id, recipientId);
    setBusyRecipientId(null);

    if (!result.ok) {
      setFeedback({ tone: "danger", title: "Could not reissue link", message: result.error });
      return;
    }

    setIssuedLinks((prev) => [result.data, ...prev]);
    setShare((prev) => ({
      ...prev,
      recipients: prev.recipients.map((r) =>
        r.id === recipientId ? { ...r, expiresAt: result.data.expiresAt, usedAt: null } : r,
      ),
    }));
    router.refresh();
  };

  const handleRemoveRecipient = async (recipientId: string) => {
    if (busyRecipientId) {
      return;
    }
    setBusyRecipientId(recipientId);
    setFeedback(null);
    const result = await removeShareRecipientAction(share.id, recipientId);
    setBusyRecipientId(null);

    if (!result.ok) {
      setFeedback({ tone: "danger", title: "Could not remove recipient", message: result.error });
      return;
    }

    setShare((prev) => ({
      ...prev,
      recipients: prev.recipients.filter((r) => r.id !== recipientId),
    }));
    router.refresh();
  };

  const handleTogglePhoto = (photoId: string, checked: boolean) => {
    setSelectedPhotoIds((prev) => {
      if (checked) {
        return prev.includes(photoId) ? prev : [...prev, photoId];
      }
      return prev.filter((id) => id !== photoId);
    });
  };

  const handleSaveSubset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (savingSubset) {
      return;
    }

    if (subsetChoice === "frozen" && selectedPhotoIds.length === 0) {
      setFeedback({
        tone: "danger",
        title: "No photos selected",
        message: "Select at least one photo for a frozen subset, or switch to Whole album.",
      });
      return;
    }

    setSavingSubset(true);
    setFeedback(null);
    const result = await setSharePhotosAction(
      share.id,
      subsetChoice === "whole" ? null : selectedPhotoIds,
    );
    setSavingSubset(false);

    if (!result.ok) {
      setFeedback({ tone: "danger", title: "Could not save photo subset", message: result.error });
      return;
    }

    setShare(result.data.share);
    setFeedback({
      tone: "success",
      title: "Photo subset saved",
      message: result.data.share.photoIds
        ? `Frozen to ${formatCount(result.data.share.photoIds.length)} selected photos.`
        : "Following the whole album.",
    });
    router.refresh();
  };

  const handleSaveBranding = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (savingBranding) {
      return;
    }

    const branding: BrandingOverride = {};
    const trimmedTitle = brandingTitle.trim();
    const trimmedLogo = brandingLogo.trim();
    const trimmedAccent = brandingAccent.trim();
    const trimmedWelcome = brandingWelcome.trim();

    if (trimmedAccent && !/^#[0-9a-fA-F]{6}$/.test(trimmedAccent)) {
      setFeedback({
        tone: "danger",
        title: "Check the accent color",
        message: "Use a six-digit hex color like #b4532a.",
      });
      return;
    }

    if (trimmedTitle) {
      branding.title = trimmedTitle;
    }
    if (trimmedLogo) {
      branding.logo = trimmedLogo;
    }
    if (trimmedAccent) {
      branding.accent = trimmedAccent;
    }
    if (trimmedWelcome) {
      branding.welcomeMessage = trimmedWelcome;
    }

    const stripMetadata =
      metadataPolicy === "inherit" ? null : metadataPolicy === "strip";

    setSavingBranding(true);
    setFeedback(null);
    const result = await updateShareAction(share.id, {
      branding: Object.keys(branding).length > 0 ? branding : null,
      stripMetadata,
    });
    setSavingBranding(false);

    if (!result.ok) {
      setFeedback({
        tone: "danger",
        title: "Could not save branding & metadata",
        message: result.error,
      });
      return;
    }

    setShare(result.data.share);
    setFeedback({
      tone: "success",
      title: "Branding & metadata saved",
      message: "Client folio styling and EXIF policy updated.",
    });
    router.refresh();
  };

  return (
    <section className="admin-page" aria-labelledby="share-detail-heading">
      <Breadcrumbs
        items={[
          { label: "Shares", href: "/admin/shares" },
          {
            label: albumTitle,
            href: `/admin/albums/${encodeURIComponent(share.albumId)}`,
          },
          { label: sharePath },
        ]}
      />

      <header className="admin-page-header">
        <div>
          <div className="admin-page-title">
            <h1 id="share-detail-heading">{albumTitle}</h1>
            <span className={`admin-status-pill ${isExpired ? "is-failed" : "is-ready"}`}>
              {isExpired ? "Expired" : "Active"}
            </span>
          </div>
          <p className="auth-lede">
            <code>{sharePath}</code> · {MODE_LABELS[share.mode]}
            {albumSlug ? ` · album /${albumSlug}` : ""}
          </p>
        </div>

        <div className="specimen-inline-cluster">
          <Button
            variant="secondary"
            size="md"
            onClick={() =>
              void handleCopy("header-link", `${window.location.origin}${sharePath}`)
            }
          >
            {copiedKey === "header-link" ? "Copied link" : "Copy link"}
          </Button>
          <Link
            href={sharePath}
            target="_blank"
            className="ui-btn ui-btn-primary ui-btn-md"
          >
            <span className="ui-btn-label">Open share →</span>
          </Link>
        </div>
      </header>

      {feedback && (
        <Alert
          tone={feedback.tone}
          title={feedback.title}
          onDismiss={() => setFeedback(null)}
        >
          {feedback.message}
        </Alert>
      )}

      {issuedLinks.length > 0 && (
        <Alert
          tone="success"
          title="Copy one-time magic links now"
          onDismiss={() => setIssuedLinks([])}
        >
          <div className="admin-dialog-stack">
            {issuedLinks.map((link) => (
              <div key={`${link.recipientId}-${link.expiresAt}`} className="specimen-inline-cluster">
                <strong>{link.email}</strong>
                <code>{link.url}</code>
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
        </Alert>
      )}

      <div className="admin-metrics is-four">
        <article className="admin-metric">
          <span className="admin-metric-label">Visits</span>
          <strong className="admin-metric-value">{formatCount(share.visits)}</strong>
          <span className="admin-metric-note">
            {share.lastVisitAt
              ? `Last visit ${formatRelative(share.lastVisitAt, now)}`
              : "No visits yet"}
          </span>
        </article>

        <article className="admin-metric">
          <span className="admin-metric-label">Photos included</span>
          <strong className="admin-metric-value">
            {share.photoIds
              ? formatCount(share.photoIds.length)
              : formatCount(albumPhotos.length)}
          </strong>
          <span className="admin-metric-note">
            {share.photoIds ? "Frozen subset" : "Whole album"}
          </span>
        </article>

        <article className="admin-metric">
          <span className="admin-metric-label">
            {share.mode === "magic_link" ? "Recipients" : "Access mode"}
          </span>
          <strong className="admin-metric-value">
            {share.mode === "magic_link"
              ? formatCount(share.recipients.length)
              : MODE_LABELS[share.mode]}
          </strong>
          <span className="admin-metric-note">
            {share.expiresAt
              ? isExpired
                ? `Expired ${formatDay(share.expiresAt)}`
                : `Expires ${formatDay(share.expiresAt)}`
              : "Never expires"}
          </span>
        </article>

        <article className="admin-metric">
          <span className="admin-metric-label">Downloads & favorites</span>
          <strong className="admin-metric-value">—</strong>
          <span className="admin-metric-note">Analytics breakdown coming soon</span>
        </article>
      </div>

      <Fieldset
        legend="1 · Access & downloads"
        description="Change how guests unlock the share link, when it expires, and which file sizes they may save."
      >
        <form onSubmit={handleSaveAccess} className="admin-dialog-stack" noValidate>
          <RadioGroup
            name="detail-share-mode"
            legend="Access mode"
            value={mode}
            disabled={savingAccess}
            onChange={(value) => setMode(value as ShareMode)}
            options={[
              { value: "public", label: "Public link" },
              { value: "password", label: "Password protected" },
              { value: "magic_link", label: "One-time magic link" },
            ]}
          />

          {mode === "password" && (
            <Field
              htmlFor="detail-share-password"
              label="Share password"
              optionalLabel={share.mode === "password" ? "Optional to keep existing" : "Required"}
              hint="Minimum 8 characters. Leave blank if already password-protected to keep current password."
            >
              <Input
                id="detail-share-password"
                type="password"
                value={password}
                disabled={savingAccess}
                placeholder={share.mode === "password" ? "Enter new password to rotate" : "At least 8 characters"}
                onChange={(event) => setPassword(event.target.value)}
              />
            </Field>
          )}

          <RadioGroup
            name="detail-share-expiry"
            legend="Link expiration"
            value={expiryChoice}
            disabled={savingAccess}
            onChange={(value) => setExpiryChoice(value as "never" | "date")}
            options={[
              { value: "never", label: "Never expires" },
              { value: "date", label: "Expire on a specific UTC date" },
            ]}
          />

          {expiryChoice === "date" && (
            <Field htmlFor="detail-share-expiry-date" label="Expiration date">
              <Input
                id="detail-share-expiry-date"
                type="date"
                min={todayDate}
                value={expiryDate}
                disabled={savingAccess}
                onChange={(event) => setExpiryDate(event.target.value)}
              />
            </Field>
          )}

          <Switch
            id="detail-allow-download"
            checked={allowDownload}
            disabled={savingAccess}
            onChange={setAllowDownload}
            label="Allow photo and ZIP downloads"
          />

          {allowDownload && (
            <div className="admin-dialog-stack">
              <Checkbox
                id="detail-quality-original"
                checked={allowOriginal}
                disabled={savingAccess}
                onChange={(event) => setAllowOriginal(event.target.checked)}
                label="Original"
                description="Full-resolution Drive files."
              />
              <Checkbox
                id="detail-quality-web"
                checked={allowWeb}
                disabled={savingAccess}
                onChange={(event) => setAllowWeb(event.target.checked)}
                label="Web 2048"
                description="2048px JPEG copies."
              />
            </div>
          )}

          <div>
            <Button type="submit" variant="primary" loading={savingAccess}>
              Save access & downloads
            </Button>
          </div>
        </form>
      </Fieldset>

      {share.mode === "magic_link" && (
        <Fieldset
          legend="2 · Magic-link recipients"
          description="Invite guests or reissue a fresh one-time sign-in link."
        >
          <form onSubmit={handleAddRecipient} className="admin-input-row" noValidate>
            <Input
              type="email"
              aria-label="Recipient email"
              value={newRecipientEmail}
              disabled={addingRecipient}
              placeholder="guest@example.com"
              onChange={(event) => setNewRecipientEmail(event.target.value)}
            />
            <Button type="submit" variant="secondary" loading={addingRecipient}>
              Add & issue link
            </Button>
          </form>

          {share.recipients.length === 0 ? (
            <EmptyState
              title="No recipients yet"
              description="Add an email above to generate a one-time guest link."
            />
          ) : (
            <DataTable
              rowKeyField="id"
              columns={[
                { key: "email", header: "Email" },
                { key: "status", header: "Status" },
                { key: "actions", header: "Actions", numeric: true },
              ]}
              rows={share.recipients.map((recipient) => ({
                id: recipient.id,
                email: <strong>{recipient.email}</strong>,
                status: recipientStatus(recipient, now),
                actions: (
                  <div className="admin-table-actions">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busyRecipientId === recipient.id}
                      onClick={() => void handleReissue(recipient.id)}
                    >
                      Reissue link
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={busyRecipientId === recipient.id}
                      onClick={() => void handleRemoveRecipient(recipient.id)}
                    >
                      Remove
                    </Button>
                  </div>
                ),
              }))}
            />
          )}
        </Fieldset>
      )}

      <Fieldset
        legend="3 · Photo subset"
        description="Follow the entire album or freeze this share to specific indexed photos."
      >
        <form onSubmit={handleSaveSubset} className="admin-dialog-stack" noValidate>
          <RadioGroup
            name="detail-share-subset"
            legend="Included photos"
            value={subsetChoice}
            disabled={savingSubset}
            onChange={(value) => {
              const next = value as "whole" | "frozen";
              setSubsetChoice(next);
              if (next === "frozen" && selectedPhotoIds.length === 0 && albumPhotos.length > 0) {
                setSelectedPhotoIds(albumPhotos.map((photo) => photo.id));
              }
            }}
            options={[
              {
                value: "whole",
                label: "Whole album",
                description: `Includes all ${formatCount(albumPhotos.length)} indexed photos automatically.`,
              },
              {
                value: "frozen",
                label: "Frozen subset",
                description: `${formatCount(selectedPhotoIds.length)} selected out of ${formatCount(albumPhotos.length)}.`,
              },
            ]}
          />

          {subsetChoice === "frozen" && (
            <div className="admin-dialog-stack">
              {albumPhotos.length === 0 ? (
                <EmptyState
                  title="No indexed photos in album"
                  description="Re-index the album before freezing a subset."
                />
              ) : (
                <>
                  <div className="admin-toolbar">
                    <Input
                      type="search"
                      className="admin-search"
                      aria-label="Filter album photos"
                      placeholder="Filter photos by filename…"
                      value={subsetQuery}
                      onChange={(event) => {
                        setSubsetQuery(event.target.value);
                        setSubsetVisibleCount(SUBSET_INITIAL_COUNT);
                      }}
                    />
                    <div className="specimen-inline-cluster">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={savingSubset}
                        onClick={() => setSelectedPhotoIds(albumPhotos.map((p) => p.id))}
                      >
                        Select all
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={savingSubset}
                        onClick={() => setSelectedPhotoIds([])}
                      >
                        Clear
                      </Button>
                    </div>
                  </div>

                  <div className="admin-folder-list">
                    {displayedSubsetPhotos.map((photo) => (
                      <div key={photo.id} className="admin-folder-row">
                        <Checkbox
                          id={`subset-photo-${photo.id}`}
                          checked={selectedSet.has(photo.id)}
                          disabled={savingSubset}
                          onChange={(event) =>
                            handleTogglePhoto(photo.id, event.target.checked)
                          }
                          label={photo.name}
                          description={
                            photo.width && photo.height
                              ? `${photo.width} × ${photo.height}`
                              : undefined
                          }
                        />
                      </div>
                    ))}
                  </div>

                  {filteredPhotos.length > SUBSET_INITIAL_COUNT && (
                    <div className="admin-pager">
                      <span className="admin-pager-count tabular-nums">
                        Showing {displayedSubsetPhotos.length} of {filteredPhotos.length}
                      </span>
                      <div className="specimen-inline-cluster">
                        {displayedSubsetPhotos.length < filteredPhotos.length && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() =>
                              setSubsetVisibleCount((prev) =>
                                Math.min(filteredPhotos.length, prev + 24),
                              )
                            }
                          >
                            Show more
                          </Button>
                        )}
                        {subsetVisibleCount > SUBSET_INITIAL_COUNT && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSubsetVisibleCount(SUBSET_INITIAL_COUNT)}
                          >
                            Show fewer
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <div>
            <Button type="submit" variant="secondary" loading={savingSubset}>
              Save photo subset
            </Button>
          </div>
        </form>
      </Fieldset>

      <Fieldset
        legend="4 · Branding & metadata"
        description={`Override organization defaults (${orgDefaults.title || orgDefaults.name}) or the thumbnail metadata policy for this link.`}
      >
        <form onSubmit={handleSaveBranding} className="admin-dialog-stack" noValidate>
          <div className="specimen-form-grid">
            <Field
              htmlFor="detail-branding-title"
              label="Gallery title override"
              optionalLabel="Optional"
            >
              <Input
                id="detail-branding-title"
                value={brandingTitle}
                maxLength={120}
                disabled={savingBranding}
                placeholder={orgDefaults.title || orgDefaults.name}
                onChange={(event) => setBrandingTitle(event.target.value)}
              />
            </Field>

            <Field
              htmlFor="detail-branding-logo"
              label="Logo URL override"
              optionalLabel="Optional"
              hint={orgDefaults.logo ? "Leave blank to inherit the organization logo." : "Leave blank to use the title initial."}
            >
              <div className="brand-preview-row">
                <BrandMark
                  title={brandingTitle || orgDefaults.title || orgDefaults.name}
                  logo={brandingLogo || orgDefaults.logo}
                />
                <Input
                  id="detail-branding-logo"
                  value={brandingLogo}
                  maxLength={2000}
                  disabled={savingBranding}
                  placeholder={orgDefaults.logo ?? "https://example.com/logo.png"}
                  onChange={(event) => setBrandingLogo(event.target.value)}
                />
              </div>
            </Field>

            <Field
              htmlFor="detail-branding-accent"
              label="Accent hex color"
              optionalLabel="Optional"
              hint={orgDefaults.accent ? `Organization default: ${orgDefaults.accent}` : "Format: #rrggbb"}
            >
              <Input
                id="detail-branding-accent"
                value={brandingAccent}
                maxLength={7}
                disabled={savingBranding}
                placeholder={orgDefaults.accent ?? "#b4532a"}
                onChange={(event) => setBrandingAccent(event.target.value)}
              />
            </Field>
          </div>

          <Field
            htmlFor="detail-branding-welcome"
            label="Welcome message"
            optionalLabel="Optional"
          >
            <Textarea
              id="detail-branding-welcome"
              rows={3}
              value={brandingWelcome}
              maxLength={500}
              currentLength={brandingWelcome.length}
              disabled={savingBranding}
              placeholder="Write a brief note for guests opening this gallery…"
              onChange={(event) => setBrandingWelcome(event.target.value)}
            />
          </Field>

          <RadioGroup
            name="detail-metadata-policy"
            legend="Thumbnail & web copy metadata"
            value={metadataPolicy}
            disabled={savingBranding}
            onChange={(value) => setMetadataPolicy(value as MetadataChoice)}
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

          <div>
            <Button type="submit" variant="secondary" loading={savingBranding}>
              Save branding & metadata
            </Button>
          </div>
        </form>
      </Fieldset>

      <Fieldset
        legend="Danger Zone"
        description="Revoke this share link immediately. Existing client sessions lose access; historical analytics are preserved."
      >
        <div>
          <Button variant="danger" size="md" onClick={() => setRevokeOpen(true)}>
            Revoke share
          </Button>
        </div>
      </Fieldset>

      <ShareRevokeDialog
        share={revokeOpen ? share : null}
        onClose={() => setRevokeOpen(false)}
        onDone={(result) => {
          setRevokeOpen(false);
          if (result.ok) {
            router.push("/admin/shares");
            router.refresh();
            return;
          }
          setFeedback({ tone: "danger", title: "Revoke failed", message: result.error });
        }}
      />
    </section>
  );
}
