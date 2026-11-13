"use client";

import { useState, type CSSProperties } from "react";
import Link from "next/link";
import config from "../../../config.json";
import {
  AccessCodeGate,
  Accordion,
  Alert,
  Banner,
  Breadcrumbs,
  Button,
  Checkbox,
  DataTable,
  Dialog,
  DocumentRow,
  Drawer,
  EmptyState,
  Field,
  Fieldset,
  FileDropzone,
  GuestPassRow,
  IconButton,
  Input,
  Pagination,
  Panel,
  ProgressBar,
  RadioGroup,
  ScheduleRow,
  Select,
  Skeleton,
  Switch,
  Tabs,
  Textarea,
  type UploadedFileItem,
} from "@/components/ui";

type SpecimenMode = "default" | "error" | "disabled" | "loading";

const brandStyle = {
  "--brand-accent": config.brand.accent,
  "--brand-ink": config.brand.ink,
  "--brand-paper": config.brand.paper,
  "--brand-surface": config.brand.surface,
} as CSSProperties;

const VENUE_OPTIONS = [
  { value: "main-hall", label: "Main Hall · North Pavilion" },
  { value: "studio-b", label: "Studio B · Briefing Room" },
  { value: "courtyard", label: "Courtyard Colonnade" },
];

const VISIBILITY_OPTIONS = [
  {
    value: "public",
    label: "Public event folio",
    description: "Anyone with the event link can view schedules and arrival notes.",
  },
  {
    value: "passcode",
    label: "Client access code required",
    description: "Visitors enter an access code before viewing deliverables.",
  },
  {
    value: "private",
    label: "Organizer draft only",
    description: "Visible only to signed-in production leads until doors open.",
  },
];

export default function ShowcasePage() {
  const [mode, setMode] = useState<SpecimenMode>("default");
  const [eventTitle, setEventTitle] = useState("Autumn Architecture Symposium");
  const [venueSlug, setVenueSlug] = useState("north-pavilion");
  const [contactEmail, setContactEmail] = useState("desk@potokuadrat.org");
  const [hallZone, setHallZone] = useState("main-hall");
  const [arrivalNotes, setArrivalNotes] = useState(
    "Step-free entry is on the west terrace beside the accreditation desk. Doors open 45 minutes prior to the keynote."
  );
  const [sendPressDigest, setSendPressDigest] = useState(true);
  const [allowGuestDownloads, setAllowGuestDownloads] = useState(false);
  const [visibilityMode, setVisibilityMode] = useState("public");
  const [liveSyncEnabled, setLiveSyncEnabled] = useState(true);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileItem[]>([
    { name: "pavilion-floorplan-v4.pdf", sizeBytes: 1843200 },
    { name: "stage-lighting-cue-sheet.pdf", sizeBytes: 642048 },
  ]);
  const [bannerVisible, setBannerVisible] = useState(true);
  const [activeTab, setActiveTab] = useState("schedule");
  const [currentPage, setCurrentPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [guestCheckedIn, setGuestCheckedIn] = useState(false);
  const [vaultCode, setVaultCode] = useState("PK-2026-AUTUMN");
  const [lastActionNotice, setLastActionNotice] = useState<string | null>(null);

  const isError = mode === "error";
  const isDisabled = mode === "disabled";
  const isLoading = mode === "loading";

  return (
    <main className="folio-frame" style={brandStyle}>
      <header className="site-navbar">
        <div className="navbar-inner">
          <Link className="navbar-brand" href="/" aria-label={`${config.eventName} home`}>
            <span className="brand-stamp" aria-hidden="true">P</span>
            <span>{config.eventName}</span>
          </Link>

          <nav className="specimen-jump-nav" aria-label="Specimen sections">
            <a href="#forms">Forms</a>
            <a href="#selection">Selection</a>
            <a href="#feedback">Feedback</a>
            <a href="#navigation">Data &amp; Navigation</a>
            <a href="#overlays">Overlays</a>
            <a href="#event-primitives">Event Primitives</a>
          </nav>

          <Link href="/" className="navbar-login-btn">
            Back to home
          </Link>
        </div>
      </header>

      <div className="specimen-state-bar" role="region" aria-label="Specimen state controls">
        <div className="specimen-state-inner">
          <span className="specimen-state-label">Inspect specimen state:</span>
          <div className="specimen-state-buttons" role="group" aria-label="State mode">
            {(
              [
                { id: "default", label: "Interactive (Default)" },
                { id: "error", label: "Validation Error" },
                { id: "disabled", label: "Disabled" },
                { id: "loading", label: "Loading" },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={mode === item.id}
                onClick={() => setMode(item.id)}
                className={`specimen-mode-btn ${
                  mode === item.id ? "specimen-mode-btn-active" : ""
                }`.trim()}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="folio-page" id="top">
        <section className="specimen-intro" aria-labelledby="specimen-heading">
          <div className="specimen-intro-header">
            <h1 id="specimen-heading">Component Specimen Folio</h1>
            <p className="specimen-intro-copy">
              Modular, reusable interface primitives built for {config.eventName}. Every control uses botanical ink rules, square folio geometry, and workhorse sans typography with tabular numerals.
            </p>
          </div>
          {lastActionNotice && (
            <Alert
              tone="success"
              title="Specimen interaction recorded"
              onDismiss={() => setLastActionNotice(null)}
            >
              {lastActionNotice}
            </Alert>
          )}
        </section>

        <section className="specimen-chapter" id="forms" aria-labelledby="chapter-forms">
          <div className="specimen-chapter-head">
            <h2 id="chapter-forms">Forms &amp; Text Controls</h2>
            <p>Buttons, field wrappers, inputs, select menus, and counted textareas with explicit recovery copy.</p>
          </div>

          <div className="specimen-row">
            <div className="specimen-meta">
              <h3>Buttons &amp; Icon Actions</h3>
              <p>Four semantic variants across three heights. Primary uses the leaf accent for the single lead action.</p>
            </div>
            <div className="specimen-stage">
              <div className="specimen-inline-cluster">
                <Button
                  variant="primary"
                  disabled={isDisabled}
                  loading={isLoading}
                  onClick={() => setLastActionNotice("Published event schedule update.")}
                  iconRight={
                    <svg viewBox="0 0 16 16" fill="none">
                      <path
                        d="M3.5 8h8.5M8.5 4.5L12 8l-3.5 3.5"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  }
                >
                  Publish schedule
                </Button>
                <Button
                  variant="secondary"
                  disabled={isDisabled}
                  loading={isLoading}
                  onClick={() => setLastActionNotice("Saved draft to organizer workspace.")}
                >
                  Save draft
                </Button>
                <Button
                  variant="ghost"
                  disabled={isDisabled}
                  loading={isLoading}
                  onClick={() => setLastActionNotice("Opened preview in guest mode.")}
                >
                  Preview folio
                </Button>
                <Button
                  variant="danger"
                  disabled={isDisabled}
                  loading={isLoading}
                  onClick={() => setDialogOpen(true)}
                >
                  Revoke access
                </Button>
              </div>

              <div className="specimen-inline-cluster">
                <Button variant="secondary" size="sm" disabled={isDisabled} loading={isLoading}>
                  Small (36px)
                </Button>
                <Button variant="secondary" size="md" disabled={isDisabled} loading={isLoading}>
                  Standard (44px)
                </Button>
                <Button variant="secondary" size="lg" disabled={isDisabled} loading={isLoading}>
                  Large (52px)
                </Button>
                <IconButton
                  aria-label="Copy event folio link"
                  variant="secondary"
                  disabled={isDisabled}
                  loading={isLoading}
                  onClick={() => setLastActionNotice("Copied folio link to clipboard.")}
                >
                  <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <rect x="5.5" y="5.5" width="7.5" height="7.5" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M3 10.5V3h7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </IconButton>
              </div>
            </div>
          </div>

          <div className="specimen-row">
            <div className="specimen-meta">
              <h3>Field, Input, Select &amp; Textarea</h3>
              <p>Text controls with prefix/suffix slots, high-contrast placeholders, and inline validation alerts.</p>
            </div>
            <div className="specimen-stage">
              <Fieldset
                legend="Event Identity & Routing"
                description="Public title and canonical URL path shown to invited guests."
                error={isError ? "Fix the highlighted fields before publishing the event folio." : undefined}
              >
                <div className="specimen-form-grid">
                  <Field
                    htmlFor="specimen-event-title"
                    label="Event title"
                    hint="Displayed in the top bar and document headers."
                    error={isError ? "Enter an event title between 4 and 80 characters." : undefined}
                  >
                    <Input
                      id="specimen-event-title"
                      value={eventTitle}
                      onChange={(e) => setEventTitle(e.target.value)}
                      placeholder="e.g. Autumn Architecture Symposium"
                      invalid={isError}
                      disabled={isDisabled || isLoading}
                    />
                  </Field>

                  <Field
                    htmlFor="specimen-venue-slug"
                    label="Public folio path"
                    optionalLabel="Required"
                    hint="Lowercase letters and hyphens only."
                    error={isError ? "Path is already assigned. Choose a unique slug." : undefined}
                  >
                    <Input
                      id="specimen-venue-slug"
                      value={venueSlug}
                      onChange={(e) => setVenueSlug(e.target.value)}
                      prefix="potokuadrat.org/"
                      suffix="/folio"
                      invalid={isError}
                      disabled={isDisabled || isLoading}
                    />
                  </Field>
                </div>

                <div className="specimen-form-grid">
                  <Field
                    htmlFor="specimen-contact-email"
                    label="Hospitality desk email"
                    optionalLabel="Optional"
                    hint="Shown on guest arrival passes."
                  >
                    <Input
                      id="specimen-contact-email"
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      invalid={isError}
                      disabled={isDisabled || isLoading}
                    />
                  </Field>

                  <Field
                    htmlFor="specimen-venue-select"
                    label="Primary stage zone"
                    hint="Default zone selected when guests open the schedule."
                  >
                    <Select
                      id="specimen-venue-select"
                      value={hallZone}
                      onChange={(e) => setHallZone(e.target.value)}
                      options={VENUE_OPTIONS}
                      invalid={isError}
                      disabled={isDisabled || isLoading}
                    />
                  </Field>
                </div>

                <Field
                  htmlFor="specimen-arrival-notes"
                  label="Arrival & accreditation instructions"
                  hint="Keep under 280 characters so mobile passes stay scannable."
                  error={isError ? "Include accreditation desk hours and step-free access." : undefined}
                >
                  <Textarea
                    id="specimen-arrival-notes"
                    rows={3}
                    maxLength={280}
                    currentLength={arrivalNotes.length}
                    value={arrivalNotes}
                    onChange={(e) => setArrivalNotes(e.target.value)}
                    invalid={isError}
                    disabled={isDisabled || isLoading}
                  />
                </Field>
              </Fieldset>
            </div>
          </div>
        </section>

        <section className="specimen-chapter" id="selection" aria-labelledby="chapter-selection">
          <div className="specimen-chapter-head">
            <h2 id="chapter-selection">Selection &amp; File Upload</h2>
            <p>Square checkboxes, radio groups, tactile switches, and packet dropzones with tabular byte readouts.</p>
          </div>

          <div className="specimen-row">
            <div className="specimen-meta">
              <h3>Checkbox, RadioGroup &amp; Switch</h3>
              <p>Custom-drawn selection controls preserving native keyboard focus and screen-reader semantics.</p>
            </div>
            <div className="specimen-stage">
              <div className="specimen-selection-stack">
                <Checkbox
                  id="chk-press-digest"
                  label="Send daily run-of-show digest to accredited press"
                  description="Dispatches a plain-text schedule summary at 07:30 local time."
                  checked={sendPressDigest}
                  onChange={(e) => setSendPressDigest(e.target.checked)}
                  invalid={isError}
                  disabled={isDisabled || isLoading}
                />
                <Checkbox
                  id="chk-guest-downloads"
                  label="Allow guests to download uncompressed photography masters"
                  description="When unchecked, full-resolution archives stay in the client vault."
                  checked={allowGuestDownloads}
                  onChange={(e) => setAllowGuestDownloads(e.target.checked)}
                  invalid={isError}
                  disabled={isDisabled || isLoading}
                />
              </div>

              <RadioGroup
                legend="Folio Access Policy"
                name="folio-visibility"
                value={visibilityMode}
                onChange={setVisibilityMode}
                options={VISIBILITY_OPTIONS}
                disabled={isDisabled || isLoading}
                error={isError ? "Select an access policy before sending guest passes." : undefined}
              />

              <Switch
                id="switch-live-sync"
                checked={liveSyncEnabled}
                onChange={setLiveSyncEnabled}
                label="Live stage cue synchronization"
                description="Advances the active session row on guest devices when cues complete."
                disabled={isDisabled || isLoading}
              />
            </div>
          </div>

          <div className="specimen-row">
            <div className="specimen-meta">
              <h3>FileDropzone</h3>
              <p>Drag-and-drop uploader for PDF briefing packets and press stills.</p>
            </div>
            <div className="specimen-stage">
              <FileDropzone
                id="specimen-dropzone"
                label="Drop event PDF packets or press stills here"
                hint="Supports PDF, JPG, and PNG up to 25 MB per file."
                files={uploadedFiles}
                onAddFiles={(incoming) => setUploadedFiles((prev) => [...prev, ...incoming])}
                onRemoveFile={(name) =>
                  setUploadedFiles((prev) => prev.filter((item) => item.name !== name))
                }
                disabled={isDisabled}
                loading={isLoading}
                error={
                  isError
                    ? "stage-lighting-cue-sheet.pdf exceeds 25 MB. Upload a compressed packet."
                    : undefined
                }
              />
            </div>
          </div>
        </section>

        <section className="specimen-chapter" id="feedback" aria-labelledby="chapter-feedback">
          <div className="specimen-chapter-head">
            <h2 id="chapter-feedback">Feedback &amp; Progress</h2>
            <p>Full-perimeter ruled alerts, live banners, linear capacity bars, skeletons, and empty states.</p>
          </div>

          <div className="specimen-row">
            <div className="specimen-meta">
              <h3>Alert &amp; Banner</h3>
              <p>1px perimeter borders and subtle tonal surfaces without decorative side stripes.</p>
            </div>
            <div className="specimen-stage">
              {bannerVisible ? (
                <Banner
                  title="Doors to North Pavilion open at 08:30"
                  detail="Keynote seating is general admission for badge holders."
                  actionLabel="View seating map"
                  onAction={() => setLastActionNotice("Opened North Pavilion seating map.")}
                  onDismiss={() => setBannerVisible(false)}
                />
              ) : (
                <Button variant="secondary" size="sm" onClick={() => setBannerVisible(true)}>
                  Restore announcement banner
                </Button>
              )}

              <Alert
                tone={isError ? "danger" : "neutral"}
                title={isError ? "Storage bucket connection interrupted" : "Self-hosted configuration active"}
              >
                {isError
                  ? "Unable to reach Supabase Storage for press masters. Verify your bucket policy and retry."
                  : "Palette tokens and organizer identity are loaded from root config.json."}
              </Alert>

              <Alert tone="warning" title="Afternoon workshop approaching capacity">
                Studio B has 6 seats remaining. Enable overflow audio relay in Courtyard Colonnade if needed.
              </Alert>
            </div>
          </div>

          <div className="specimen-row">
            <div className="specimen-meta">
              <h3>ProgressBar, Skeleton &amp; EmptyState</h3>
              <p>Tabular capacity readouts, calm loading bars, and actionable empty states.</p>
            </div>
            <div className="specimen-stage">
              <ProgressBar
                label="Accredited guest check-in progress"
                value={142}
                max={180}
                unitLabel="guests arrived"
              />
              <div className="specimen-subblock">
                <span className="specimen-subblock-label">Skeleton loading placeholder</span>
                <Skeleton lines={3} />
              </div>
              <EmptyState
                title="No post-event deliverables uploaded yet"
                description="Upload master photography selects and the wrap summary here once the event concludes."
                action={
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={isDisabled}
                    loading={isLoading}
                    onClick={() =>
                      setUploadedFiles((prev) => [
                        ...prev,
                        { name: "keynote-master-selects.zip", sizeBytes: 14820400 },
                      ])
                    }
                  >
                    Upload first deliverable
                  </Button>
                }
                secondaryAction={
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={isDisabled}
                    onClick={() => setLastActionNotice("Imported template checklist.")}
                  >
                    Load checklist
                  </Button>
                }
              />
            </div>
          </div>
        </section>

        <section className="specimen-chapter" id="navigation" aria-labelledby="chapter-navigation">
          <div className="specimen-chapter-head">
            <h2 id="chapter-navigation">Navigation &amp; Data Tables</h2>
            <p>Breadcrumbs, WAI-ARIA tabs, ruled accordions, tabular tables, panels, and pagination.</p>
          </div>

          <div className="specimen-row">
            <div className="specimen-meta">
              <h3>Breadcrumbs, Tabs &amp; Panel</h3>
              <p>Wayfinding and view switching without nested card clutter.</p>
            </div>
            <div className="specimen-stage">
              <Breadcrumbs
                items={[
                  { label: "Potokuadrat", href: "/" },
                  { label: "Autumn Symposium", href: "#top" },
                  { label: "Production Schedule" },
                ]}
              />
              <Tabs
                ariaLabel="Event workspace views"
                activeId={activeTab}
                onChange={setActiveTab}
                tabs={[
                  {
                    id: "schedule",
                    label: "Run of Show",
                    count: 8,
                    content: (
                      <Panel
                        title="Morning Stage Sequence"
                        subtitle="North Pavilion · Synchronized with stage manager console"
                        headerAction={
                          <Button variant="secondary" size="sm" disabled={isDisabled} onClick={() => setDrawerOpen(true)}>
                            Edit cue sheet
                          </Button>
                        }
                      >
                        <p className="specimen-panel-copy">
                          Speaker microphones and projection aspect ratios (4:5 and 16:9) are verified 30 minutes prior to doors.
                        </p>
                      </Panel>
                    ),
                  },
                  {
                    id: "press",
                    label: "Press Kit Files",
                    count: 4,
                    content: (
                      <Panel title="Accredited Press Releases" subtitle="Embargo lifts at 10:30 local time">
                        <p className="specimen-panel-copy">
                          Includes architectural drawings, speaker biographies, and pavilion photography.
                        </p>
                      </Panel>
                    ),
                  },
                ]}
              />
            </div>
          </div>

          <div className="specimen-row">
            <div className="specimen-meta">
              <h3>DataTable, Accordion &amp; Pagination</h3>
              <p>Right-aligned tabular numerals, ruled disclosures, and page controls.</p>
            </div>
            <div className="specimen-stage">
              <DataTable
                caption="Venue zone capacities and technical readiness"
                rowKeyField="zone"
                loading={isLoading}
                columns={[
                  { key: "zone", header: "Venue Zone" },
                  { key: "lead", header: "Stage Lead" },
                  { key: "aspect", header: "Projection" },
                  { key: "capacity", header: "Capacity", numeric: true },
                ]}
                rows={[
                  { zone: "Main Hall · North Pavilion", lead: "R. Pramono", aspect: "4:5 + 16:9", capacity: "180" },
                  { zone: "Studio B · Briefing Room", lead: "S. Wijaya", aspect: "16:9 Standard", capacity: "64" },
                  { zone: "Courtyard Colonnade", lead: "A. Halim", aspect: "Audio Relay", capacity: "120" },
                ]}
              />
              <Accordion
                defaultOpenId="acc-loadin"
                items={[
                  {
                    id: "acc-loadin",
                    title: "Load-in & acoustic check protocol",
                    meta: "06:30 – 08:15",
                    content: <p>Production vehicles clear the north courtyard by 07:45. Sound check runs at 08:00 sharp.</p>,
                  },
                  {
                    id: "acc-photography",
                    title: "Square-format photography archiving",
                    meta: "Press & Crew",
                    content: <p>Square (1:1) and portrait (4:5) selects publish directly to the public showcase stream.</p>,
                  },
                ]}
              />
              <Pagination page={currentPage} totalPages={4} onPageChange={setCurrentPage} disabled={isDisabled || isLoading} />
            </div>
          </div>
        </section>

        <section className="specimen-chapter" id="overlays" aria-labelledby="chapter-overlays">
          <div className="specimen-chapter-head">
            <h2 id="chapter-overlays">Contextual Overlays</h2>
            <p>Native HTML dialog modals and slide-over drawers escaping container clipping.</p>
          </div>
          <div className="specimen-row">
            <div className="specimen-meta">
              <h3>Dialog &amp; Drawer</h3>
              <p>Drawer for in-context inspection; Dialog for destructive confirmation.</p>
            </div>
            <div className="specimen-stage">
              <div className="specimen-inline-cluster">
                <Button variant="secondary" disabled={isDisabled} onClick={() => setDrawerOpen(true)}>
                  Open cue sheet drawer
                </Button>
                <Button variant="danger" disabled={isDisabled} onClick={() => setDialogOpen(true)}>
                  Open confirmation dialog
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="specimen-chapter" id="event-primitives" aria-labelledby="chapter-primitives">
          <div className="specimen-chapter-head">
            <h2 id="chapter-primitives">Event Folio Primitives</h2>
            <p>Domain-specific rows for schedules, documents, guest passes, and client vault gates.</p>
          </div>

          <div className="specimen-row">
            <div className="specimen-meta">
              <h3>ScheduleRow, DocumentRow &amp; GuestPassRow</h3>
              <p>Ruled rows built for live event operations and public document indices.</p>
            </div>
            <div className="specimen-stage">
              <div className="specimen-ruled-stack">
                <ScheduleRow
                  time="10:30"
                  title="Opening Keynote: Material Honesty in Temporary Structures"
                  stage="Main Hall"
                  lead="Dr. Hanna Larasati"
                  duration="45 min"
                  disabled={isDisabled || isLoading}
                  onInspect={() => setDrawerOpen(true)}
                />
                <ScheduleRow
                  time="14:00"
                  title="Curated Studio Walkthrough & Archival Review"
                  stage="Studio B"
                  lead="Christian Oroh"
                  duration="60 min"
                  disabled={isDisabled || isLoading}
                  onInspect={() => setDrawerOpen(true)}
                />
              </div>

              <div className="specimen-ruled-stack">
                <DocumentRow
                  mark="A"
                  kind="Welcome note"
                  title="Symposium Overview & Curatorial Statement"
                  readingTime="3 min read"
                  fileSize="1.2 MB PDF"
                  disabled={isDisabled || isLoading}
                  onOpen={() => setLastActionNotice("Opened Symposium Overview & Curatorial Statement.")}
                />
                <DocumentRow
                  mark="B"
                  kind="Visitor guide"
                  title="Pavilion Floor Plan & Step-Free Transit Guide"
                  readingTime="5 min read"
                  fileSize="2.4 MB PDF"
                  disabled={isDisabled || isLoading}
                  onOpen={() => setLastActionNotice("Opened Pavilion Floor Plan & Step-Free Transit Guide.")}
                />
              </div>

              <div className="specimen-ruled-stack">
                <GuestPassRow
                  name="Nadia Kusuma"
                  organization="Atelier Kusuma & Partners"
                  passId="PK-084"
                  checkedIn={guestCheckedIn}
                  disabled={isDisabled || isLoading}
                  onToggleCheckIn={() => setGuestCheckedIn((prev) => !prev)}
                />
              </div>
            </div>
          </div>

          <div className="specimen-row">
            <div className="specimen-meta">
              <h3>AccessCodeGate</h3>
              <p>Inline verification form for private client deliverables and master archives.</p>
            </div>
            <div className="specimen-stage">
              <AccessCodeGate
                value={vaultCode}
                onChange={setVaultCode}
                loading={isLoading}
                disabled={isDisabled}
                error={isError ? "Access code PK-2026-AUTUMN has expired. Request a renewed key." : undefined}
                onSubmit={() => setLastActionNotice(`Verified client vault code: ${vaultCode}`)}
              />
            </div>
          </div>
        </section>

        <footer className="page-footer">
          <span>{config.eventName} UI Library</span>
          <span>Interactive Specimen Folio</span>
          <a href="#top">Back to top</a>
        </footer>
      </div>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Revoke shared client vault access?"
        description="This immediately invalidates access code PK-2026-AUTUMN until a new code is issued."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setDialogOpen(false);
                setLastActionNotice("Revoked client vault access code PK-2026-AUTUMN.");
              }}
            >
              Confirm revocation
            </Button>
          </>
        }
      >
        <p className="specimen-dialog-note">
          Public schedule and arrival guide pages remain unaffected and stay accessible to guests.
        </p>
      </Dialog>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Inspect Stage Cue · 10:30"
        description="Main Hall · North Pavilion"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDrawerOpen(false)}>
              Close
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setDrawerOpen(false);
                setLastActionNotice("Updated stage cue 10:30 notes.");
              }}
            >
              Save cue changes
            </Button>
          </>
        }
      >
        <div className="specimen-drawer-stack">
          <Field htmlFor="drawer-cue-title" label="Session title" hint="Shown on public schedule rows.">
            <Input id="drawer-cue-title" defaultValue="Opening Keynote: Material Honesty in Temporary Structures" />
          </Field>
          <Field htmlFor="drawer-cue-notes" label="Stage manager cue notes" hint="Internal note for AV crew.">
            <Textarea
              id="drawer-cue-notes"
              rows={4}
              defaultValue="Bring house lights to 30% at 10:28. Lectern mic 1 live; handheld mic 2 on standby."
            />
          </Field>
        </div>
      </Drawer>
    </main>
  );
}
