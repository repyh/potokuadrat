"use client";

import { useState } from "react";

import type { DriveStatusState, OrganizationSettings } from "@/contracts/admin";
import { Alert, Button, Field, Fieldset, Input, Switch } from "@/components/ui";

export interface SettingsMockupProps {
  initialSettings: OrganizationSettings;
  driveState: DriveStatusState;
}

export function SettingsMockup({
  initialSettings,
  driveState,
}: SettingsMockupProps) {
  const [name, setName] = useState(initialSettings.name);
  const [title, setTitle] = useState(initialSettings.title ?? "");
  const [accent, setAccent] = useState(initialSettings.accent ?? "#d9ef63");
  const [logo, setLogo] = useState(initialSettings.logo ?? "");
  const [stripMetadata, setStripMetadata] = useState(initialSettings.stripMetadata);
  const [footerEnabled, setFooterEnabled] = useState(initialSettings.footerEnabled);
  const [savedBanner, setSavedBanner] = useState(false);

  return (
    <section className="admin-page" aria-labelledby="settings-heading">
      <header className="admin-page-header">
        <div>
          <h1 id="settings-heading">Settings</h1>
        </div>
      </header>

      {savedBanner && (
        <Alert
          tone="success"
          title="Mockup preview"
          onDismiss={() => setSavedBanner(false)}
        >
          UI mockup state updated locally. Wire to updateOrganizationSettingsAction in #15.
        </Alert>
      )}

      <div className="admin-settings-sections">
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
                placeholder="Atelier Kusuma"
              />
            </Field>

            <Field
              htmlFor="org-accent"
              label="Accent color"
              hint="Hex color used for primary actions."
            >
              <Input
                id="org-accent"
                value={accent}
                onChange={(e) => setAccent(e.target.value)}
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
              label="Strip EXIF & IPTC metadata by default"
              description="Recommended for public client links."
            />

            <Switch
              id="footer-enabled"
              checked={footerEnabled}
              onChange={setFooterEnabled}
              label="Show studio attribution in share footer"
            />
          </div>
        </Fieldset>

        <Fieldset
          legend="Integrations"
          description="Service-account credentials are read from GOOGLE_DRIVE_KEY_FILE on the server."
        >
          <Alert
            tone={driveState === "reachable" ? "success" : "neutral"}
            title={
              driveState === "reachable"
                ? "Service account configured"
                : "Not configured"
            }
          >
            {driveState === "reachable"
              ? "GOOGLE_DRIVE_KEY_FILE is set on the server."
              : "Set GOOGLE_DRIVE_KEY_FILE in .env to enable folder indexing."}
          </Alert>
        </Fieldset>
      </div>

      <div>
        <Button variant="primary" size="md" onClick={() => setSavedBanner(true)}>
          Save settings
        </Button>
      </div>
    </section>
  );
}
