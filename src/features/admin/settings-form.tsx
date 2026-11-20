"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import type { DriveStatus, OrganizationSettings } from "@/contracts/admin";
import {
  getDriveStatusAction,
  updateOrganizationSettingsAction,
} from "@/app/admin/settings/actions";
import { Alert, Button, EmptyState, Field, Input, Switch, Tabs } from "@/components/ui";

export interface SettingsFormProps {
  initialSettings: OrganizationSettings;
  driveStatus: DriveStatus;
  currentUser: {
    name: string;
    email: string;
    role: string;
  };
}

export function SettingsForm({
  initialSettings,
  driveStatus: initialDriveStatus,
  currentUser,
}: SettingsFormProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("branding");

  const [name, setName] = useState(initialSettings.name);
  const [title, setTitle] = useState(initialSettings.title ?? "");
  const [accent, setAccent] = useState(initialSettings.accent ?? "");
  const [logo, setLogo] = useState(initialSettings.logo ?? "");
  const [stripMetadata, setStripMetadata] = useState(initialSettings.stripMetadata);
  const [footerEnabled, setFooterEnabled] = useState(initialSettings.footerEnabled);
  const [saving, setSaving] = useState(false);

  const [accountName, setAccountName] = useState(currentUser.name);
  const [savingAccount, setSavingAccount] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const [driveStatus, setDriveStatus] = useState<DriveStatus>(initialDriveStatus);
  const [dbHealth, setDbHealth] = useState<"unknown" | "up" | "down">("unknown");
  const [checkingHealth, setCheckingHealth] = useState(false);

  const [feedback, setFeedback] = useState<{
    tone: "success" | "danger";
    title: string;
    message: string;
  } | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) {
      return;
    }

    setSaving(true);
    setFeedback(null);

    const result = await updateOrganizationSettingsAction({
      name: name.trim(),
      title: title.trim() || null,
      logo: logo.trim() || null,
      accent: accent.trim() || null,
      footerEnabled,
      stripMetadata,
    });

    setSaving(false);

    if (!result.ok) {
      setFeedback({
        tone: "danger",
        title: "Could not save settings",
        message: result.error,
      });
      return;
    }

    setFeedback({
      tone: "success",
      title: "Settings saved",
      message: "Organization branding and delivery defaults are updated.",
    });
    router.refresh();
  };

  const handleSaveAccountName = async () => {
    if (savingAccount || !accountName.trim()) {
      return;
    }

    setSavingAccount(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/auth/update-user", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: accountName.trim() }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        setFeedback({
          tone: "danger",
          title: "Could not update profile",
          message: body?.message ?? "Unable to update account name.",
        });
        return;
      }

      setFeedback({
        tone: "success",
        title: "Profile updated",
        message: "Your display name has been updated.",
      });
      router.refresh();
    } catch {
      setFeedback({
        tone: "danger",
        title: "Could not update profile",
        message: "Network error while updating profile.",
      });
    } finally {
      setSavingAccount(false);
    }
  };

  const handleChangePassword = async () => {
    if (savingPassword) {
      return;
    }
    if (newPassword.length < 10) {
      setFeedback({
        tone: "danger",
        title: "Password too short",
        message: "New password must be at least 10 characters.",
      });
      return;
    }

    setSavingPassword(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        setFeedback({
          tone: "danger",
          title: "Password change failed",
          message: body?.message ?? "Check your current password and try again.",
        });
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setFeedback({
        tone: "success",
        title: "Password updated",
        message: "Your organizer password has been changed.",
      });
    } catch {
      setFeedback({
        tone: "danger",
        title: "Password change failed",
        message: "Network error while changing password.",
      });
    } finally {
      setSavingPassword(false);
    }
  };

  const handleRunHealthCheck = async () => {
    if (checkingHealth) {
      return;
    }

    setCheckingHealth(true);
    try {
      const [healthRes, driveRes] = await Promise.all([
        fetch("/api/health"),
        getDriveStatusAction(),
      ]);

      const healthJson = (await healthRes.json().catch(() => null)) as {
        database?: string;
      } | null;
      setDbHealth(healthRes.ok && healthJson?.database === "up" ? "up" : "down");

      if (driveRes.ok) {
        setDriveStatus(driveRes.data);
      }
    } catch {
      setDbHealth("down");
    } finally {
      setCheckingHealth(false);
    }
  };

  const driveAlertTone =
    driveStatus.state === "reachable"
      ? "success"
      : driveStatus.state === "failing"
        ? "danger"
        : "neutral";

  const folderCount = driveStatus.folderCount ?? 0;
  const driveAlertTitle =
    driveStatus.state === "reachable"
      ? `Connected (${folderCount} ${folderCount === 1 ? "folder" : "folders"} visible)`
      : driveStatus.state === "failing"
        ? "Connection failing"
        : "Not configured";

  const saveFooter = (
    <div className="admin-settings-actions">
      <Button
        type="submit"
        variant="primary"
        size="md"
        loading={saving}
        disabled={saving}
      >
        Save settings
      </Button>
    </div>
  );

  return (
    <section className="admin-page" aria-labelledby="settings-heading">
      <header className="admin-page-header">
        <div>
          <h1 id="settings-heading">Settings</h1>
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

      <form onSubmit={handleSubmit} className="admin-settings-sections" noValidate>
        <Tabs
          ariaLabel="Settings sections"
          activeId={activeTab}
          onChange={setActiveTab}
          tabs={[
            {
              id: "branding",
              label: "Branding",
              content: (
                <div className="admin-settings-panel">
                  <p className="admin-settings-intro">
                    Default studio identity inherited by every guest share folio unless
                    overridden per share.
                  </p>

                  <div className="specimen-form-grid">
                    <Field
                      htmlFor="org-name"
                      label="Organization name"
                      optionalLabel="Required"
                      hint="Shown in the admin spine and studio records."
                    >
                      <Input
                        id="org-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        disabled={saving}
                        required
                      />
                    </Field>

                    <Field
                      htmlFor="org-title"
                      label="Public folio title"
                      optionalLabel="Optional"
                      hint="Displayed in the top bar and share headers."
                    >
                      <Input
                        id="org-title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        disabled={saving}
                        placeholder="Atelier Kusuma"
                      />
                    </Field>

                    <Field
                      htmlFor="org-accent"
                      label="Accent color"
                      optionalLabel="Optional"
                      hint="Hex color used for primary actions (e.g. #d9ef63)."
                    >
                      <Input
                        id="org-accent"
                        value={accent}
                        onChange={(e) => setAccent(e.target.value)}
                        disabled={saving}
                        placeholder="#d9ef63"
                      />
                    </Field>

                    <Field
                      htmlFor="org-logo"
                      label="Logo URL"
                      optionalLabel="Optional"
                      hint="Square mark or studio wordmark URL."
                    >
                      <Input
                        id="org-logo"
                        value={logo}
                        onChange={(e) => setLogo(e.target.value)}
                        disabled={saving}
                        placeholder="https://example.com/logo.png"
                      />
                    </Field>
                  </div>

                  {saveFooter}
                </div>
              ),
            },
            {
              id: "delivery",
              label: "Delivery & Privacy",
              content: (
                <div className="admin-settings-panel">
                  <p className="admin-settings-intro">
                    Control EXIF/IPTC metadata stripping on thumbnails and web exports,
                    plus studio footer attribution.
                  </p>

                  <div className="specimen-selection-stack">
                    <Switch
                      id="strip-metadata"
                      checked={stripMetadata}
                      onChange={setStripMetadata}
                      disabled={saving}
                      label="Strip EXIF & IPTC metadata by default"
                      description="Recommended for public client links."
                    />

                    <Switch
                      id="footer-enabled"
                      checked={footerEnabled}
                      onChange={setFooterEnabled}
                      disabled={saving}
                      label="Show studio attribution in share footer"
                    />
                  </div>

                  {saveFooter}
                </div>
              ),
            },
            {
              id: "integrations",
              label: "Integrations",
              content: (
                <div className="admin-settings-panel">
                  <p className="admin-settings-intro">
                    Service-account credentials are read from{" "}
                    <code>GOOGLE_DRIVE_KEY_FILE</code> on the server.
                  </p>

                  <Alert tone={driveAlertTone} title={driveAlertTitle}>
                    {driveStatus.message}
                  </Alert>
                </div>
              ),
            },
            {
              id: "account",
              label: "My Account",
              content: (
                <div className="admin-settings-panel">
                  <div className="admin-account-group">
                    <h2 className="admin-subsection-title">Profile</h2>
                    <p className="admin-settings-intro">
                      Update your organizer display name for this installation.
                    </p>

                    <div className="specimen-form-grid">
                      <Field htmlFor="account-name" label="Display name">
                        <Input
                          id="account-name"
                          value={accountName}
                          onChange={(e) => setAccountName(e.target.value)}
                          disabled={savingAccount}
                        />
                      </Field>

                      <Field htmlFor="account-email" label="Email">
                        <Input id="account-email" value={currentUser.email} disabled />
                      </Field>
                    </div>

                    <div>
                      <Button
                        variant="secondary"
                        loading={savingAccount}
                        disabled={!accountName.trim() || savingAccount}
                        onClick={() => void handleSaveAccountName()}
                      >
                        Update profile
                      </Button>
                    </div>
                  </div>

                  <div className="admin-account-group is-separated">
                    <h2 className="admin-subsection-title">Password</h2>
                    <p className="admin-settings-intro">
                      Rotate your sign-in password. New passwords require at least 10
                      characters.
                    </p>

                    <div className="specimen-form-grid">
                      <Field htmlFor="account-current-password" label="Current password">
                        <Input
                          id="account-current-password"
                          type="password"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          disabled={savingPassword}
                        />
                      </Field>

                      <Field
                        htmlFor="account-new-password"
                        label="New password"
                        hint="At least 10 characters."
                      >
                        <Input
                          id="account-new-password"
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          disabled={savingPassword}
                        />
                      </Field>
                    </div>

                    <div>
                      <Button
                        variant="secondary"
                        loading={savingPassword}
                        disabled={!currentPassword || !newPassword || savingPassword}
                        onClick={() => void handleChangePassword()}
                      >
                        Change password
                      </Button>
                    </div>
                  </div>
                </div>
              ),
            },
            {
              id: "team",
              label: "Team & Roles",
              content: (
                <div className="admin-settings-panel">
                  <EmptyState
                    title="Team invitations"
                    description="Photographer invitations and multi-user role management will appear here once team endpoints are connected."
                  />
                </div>
              ),
            },
            {
              id: "system",
              label: "System",
              content: (
                <div className="admin-settings-panel">
                  <p className="admin-settings-intro">
                    Live database and Google Drive service-account diagnostics.
                  </p>

                  <Alert
                    tone={
                      dbHealth === "up"
                        ? "success"
                        : dbHealth === "down"
                          ? "danger"
                          : "neutral"
                    }
                    title={
                      dbHealth === "up"
                        ? "Postgres database reachable"
                        : dbHealth === "down"
                          ? "Postgres database unreachable"
                          : "Database check not run yet"
                    }
                  >
                    Checked via <code>/api/health</code>.
                  </Alert>

                  <Alert tone={driveAlertTone} title={driveAlertTitle}>
                    {driveStatus.message}
                  </Alert>

                  <div>
                    <Button
                      variant="secondary"
                      loading={checkingHealth}
                      onClick={() => void handleRunHealthCheck()}
                    >
                      Run health check
                    </Button>
                  </div>
                </div>
              ),
            },
          ]}
        />
      </form>
    </section>
  );
}
