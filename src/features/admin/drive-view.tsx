"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import type { DriveFolderOption, DriveStatus } from "@/contracts/admin";
import { recheckDriveAction } from "@/app/admin/drive/actions";
import {
  Alert,
  Button,
  DataTable,
  EmptyState,
  Field,
  Fieldset,
  Input,
} from "@/components/ui";

import { extractDriveFolderId } from "./drive-folder";
import { formatCount, formatRelative } from "./format";

export interface DriveLimitsView {
  indexMaxDepth: number;
  concurrency: number;
  cacheMaxBytes: number;
  cacheMaxFiles: number;
  evictionPolicy: string;
}

export interface DriveViewProps {
  status: DriveStatus;
  serviceAccountEmail: string | null;
  folders: DriveFolderOption[];
  foldersError: string | null;
  limits: DriveLimitsView;
  now: number;
}

const SOURCE_LABELS: Record<DriveFolderOption["source"], string> = {
  shared: "Shared with me",
  shared_drive: "Shared Drive",
  pasted: "Pasted",
};

function formatByteCap(bytes: number): string {
  const gb = bytes / 1024 ** 3;
  if (gb >= 1) {
    return `${gb % 1 === 0 ? gb.toFixed(0) : gb.toFixed(1)} GB`;
  }
  const mb = bytes / 1024 ** 2;
  return `${Math.round(mb)} MB`;
}

export function DriveView({
  status: initialStatus,
  serviceAccountEmail,
  folders: initialFolders,
  foldersError: initialFoldersError,
  limits,
  now,
}: DriveViewProps) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [folders, setFolders] = useState(initialFolders);
  const [foldersError, setFoldersError] = useState(initialFoldersError);
  const [rechecking, setRechecking] = useState(false);
  const [pastedFolder, setPastedFolder] = useState("");
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "danger";
    title: string;
    message: string;
  } | null>(null);

  const sharedDrives = useMemo(
    () => folders.filter((f) => f.source === "shared_drive"),
    [folders],
  );
  const sharedFolders = useMemo(
    () => folders.filter((f) => f.source !== "shared_drive"),
    [folders],
  );

  const statusTone =
    status.state === "reachable"
      ? "success"
      : status.state === "failing"
        ? "danger"
        : "neutral";

  const statusTitle =
    status.state === "reachable"
      ? `Connected (${formatCount(status.folderCount ?? 0)} visible)`
      : status.state === "failing"
        ? "Connection failing"
        : "Not configured";

  const handleRecheck = async () => {
    if (rechecking) {
      return;
    }
    setRechecking(true);
    setFeedback(null);
    const result = await recheckDriveAction();
    setRechecking(false);

    if (!result.ok) {
      setFeedback({
        tone: "danger",
        title: "Check failed",
        message: result.error,
      });
      return;
    }

    setStatus(result.data.status);
    setFolders(result.data.folders);
    setFoldersError(result.data.foldersError);
    router.refresh();
  };

  const handleCopyEmail = async () => {
    if (!serviceAccountEmail) {
      return;
    }
    try {
      await navigator.clipboard.writeText(serviceAccountEmail);
      setCopiedEmail(true);
      window.setTimeout(() => setCopiedEmail(false), 2000);
    } catch {
      setFeedback({
        tone: "danger",
        title: "Copy failed",
        message: "Clipboard access was blocked by this browser.",
      });
    }
  };

  const handleUsePastedFolder = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanId = extractDriveFolderId(pastedFolder);
    if (!cleanId) {
      setPasteError("Paste a valid Google Drive folder URL or folder id.");
      return;
    }
    setPasteError(null);
    router.push(`/admin/albums/new?folder=${encodeURIComponent(cleanId)}`);
  };

  const renderFolderTable = (items: DriveFolderOption[], emptyTitle: string, emptyDesc: string) => {
    if (items.length === 0) {
      return <EmptyState title={emptyTitle} description={emptyDesc} />;
    }

    return (
      <DataTable
        rowKeyField="id"
        columns={[
          { key: "name", header: "Folder" },
          { key: "source", header: "Source" },
          { key: "owner", header: "Owner" },
          { key: "actions", header: "Actions", numeric: true },
        ]}
        rows={items.map((folder) => ({
          id: folder.id,
          name: (
            <span className="admin-table-primary">
              <strong>{folder.name}</strong>
              <code className="admin-table-sub">{folder.id}</code>
            </span>
          ),
          source: SOURCE_LABELS[folder.source],
          owner: folder.ownerName ?? "—",
          actions: (
            <div className="admin-table-actions">
              <Link
                href={`/admin/albums/new?folder=${encodeURIComponent(folder.id)}&name=${encodeURIComponent(folder.name)}`}
                className="ui-btn ui-btn-ghost ui-btn-sm"
              >
                <span className="ui-btn-label">Add to album →</span>
              </Link>
            </div>
          ),
        }))}
      />
    );
  };

  return (
    <section className="admin-page" aria-labelledby="drive-heading">
      <header className="admin-page-header">
        <div>
          <h1 id="drive-heading">Drive</h1>
          <p className="auth-lede">
            Read-only Google Drive connection, shared folders, Shared Drives, and indexing limits.
          </p>
        </div>

        <div className="specimen-inline-cluster">
          <Button
            variant="secondary"
            size="md"
            loading={rechecking}
            onClick={() => void handleRecheck()}
          >
            Re-check connection
          </Button>
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

      <Fieldset
        legend="Service account"
        description="Share Google Drive folders with the service account in read-only (Viewer) mode."
      >
        <Alert tone={statusTone} title={statusTitle}>
          <div className="admin-dialog-stack">
            <span>{status.message}</span>
            <span className="admin-quiet tabular-nums">
              Last checked {formatRelative(status.checkedAt, now)}
            </span>
          </div>
        </Alert>

        <div className="admin-folder-row">
          <div className="admin-table-primary">
            <strong>Service account email</strong>
            <span className="admin-table-sub">
              {serviceAccountEmail ? (
                <code>{serviceAccountEmail}</code>
              ) : (
                "No GOOGLE_DRIVE_KEY_FILE configured."
              )}
            </span>
          </div>

          {serviceAccountEmail && (
            <Button variant="secondary" size="sm" onClick={() => void handleCopyEmail()}>
              {copiedEmail ? "Copied" : "Copy email"}
            </Button>
          )}
        </div>
      </Fieldset>

      <Fieldset
        legend="Shared Drives"
        description="Team Shared Drives accessible to the service account."
      >
        {foldersError && status.state !== "reachable" && (
          <Alert tone="neutral" title="Listing unavailable">
            {foldersError}
          </Alert>
        )}
        {renderFolderTable(
          sharedDrives,
          "No Shared Drives visible",
          "Add the service account as a Viewer to any Shared Drive you want to index.",
        )}
      </Fieldset>

      <Fieldset
        legend="Shared folders"
        description="Standard Drive folders shared directly with the service account."
      >
        {renderFolderTable(
          sharedFolders,
          "No shared folders visible",
          "Share a Drive folder with the service account email above, or paste a folder URL below.",
        )}
      </Fieldset>

      <Fieldset
        legend="Paste a folder URL"
        description="Use this fallback if Workspace policies hide shared folder listings."
      >
        <form onSubmit={handleUsePastedFolder} className="admin-dialog-stack" noValidate>
          <Field
            htmlFor="drive-paste-folder"
            label="Drive folder URL or ID"
            error={pasteError ?? undefined}
          >
            <div className="admin-input-row">
              <Input
                id="drive-paste-folder"
                value={pastedFolder}
                invalid={Boolean(pasteError)}
                onChange={(event) => {
                  setPastedFolder(event.target.value);
                  setPasteError(null);
                }}
                placeholder="https://drive.google.com/drive/folders/…"
              />
              <Button type="submit" variant="primary" size="md">
                Add to album →
              </Button>
            </div>
          </Field>
        </form>
      </Fieldset>

      <Fieldset
        legend="Indexing & cache limits"
        description="Read-only environment limits governing folder traversal and disk thumbnail storage."
      >
        <div className="admin-metrics is-four">
          <article className="admin-metric">
            <span className="admin-metric-label">Recursion depth</span>
            <strong className="admin-metric-value">{formatCount(limits.indexMaxDepth)}</strong>
            <span className="admin-metric-note">Nested folder levels</span>
          </article>

          <article className="admin-metric">
            <span className="admin-metric-label">Drive concurrency</span>
            <strong className="admin-metric-value">{formatCount(limits.concurrency)}</strong>
            <span className="admin-metric-note">Parallel downloads</span>
          </article>

          <article className="admin-metric">
            <span className="admin-metric-label">Thumb cache cap</span>
            <strong className="admin-metric-value">{formatByteCap(limits.cacheMaxBytes)}</strong>
            <span className="admin-metric-note">
              Up to {formatCount(limits.cacheMaxFiles)} files
            </span>
          </article>

          <article className="admin-metric">
            <span className="admin-metric-label">Cache eviction</span>
            <strong className="admin-metric-value">{limits.evictionPolicy}</strong>
            <span className="admin-metric-note">Automatic cleanup</span>
          </article>
        </div>
      </Fieldset>
    </section>
  );
}
