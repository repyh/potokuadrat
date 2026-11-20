"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import type { DriveStatus, OrganizationSettings } from "@/contracts/admin";
import { updateOrganizationSettingsAction } from "@/app/admin/settings/actions";
import { Alert, Button, Field, Fieldset, Input, Switch } from "@/components/ui";

export interface SettingsFormProps {
  initialSettings: OrganizationSettings;
  driveStatus: DriveStatus;
}

export function SettingsForm({ initialSettings, driveStatus }: SettingsFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initialSettings.name);
  const [title, setTitle] = useState(initialSettings.title ?? "");
  const [accent, setAccent] = useState(initialSettings.accent ?? "");
  const [logo, setLogo] = useState(initialSettings.logo ?? "");
  const [stripMetadata, setStripMetadata] = useState(initialSettings.stripMetadata);
  const [footerEnabled, setFooterEnabled] = useState(initialSettings.footerEnabled);
  const [saving, setSaving] = useState(false);
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

  const driveAlertTone =
    driveStatus.state === "reachable"
      ? "success"
      : driveStatus.state === "failing"
        ? "danger"
        : "neutral";

  const driveAlertTitle =
    driveStatus.state === "reachable"
      ? `Connected (${driveStatus.folderCount ?? 0} folders visible)`
      : driveStatus.state === "failing"
        ? "Connection failing"
        : "Not configured";

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
        <Fieldset
          legend="Studio Identity & Branding"
          description="Default studio identity inherited by every guest share folio unless overridden per share."
        >
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
        </Fieldset>

        <Fieldset
          legend="Delivery & Privacy"
          description="Control EXIF/IPTC metadata stripping on thumbnails and web exports, plus studio footer attribution."
        >
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
        </Fieldset>

        <Fieldset
          legend="Integrations"
          description="Service-account credentials are read from GOOGLE_DRIVE_KEY_FILE on the server."
        >
          <Alert tone={driveAlertTone} title={driveAlertTitle}>
            {driveStatus.message}
          </Alert>
        </Fieldset>

        <div>
          <Button type="submit" variant="primary" size="md" loading={saving} disabled={saving}>
            Save settings
          </Button>
        </div>
      </form>
    </section>
  );
}
