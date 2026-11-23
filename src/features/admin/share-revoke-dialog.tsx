"use client";

import { useState } from "react";

import type { ShareMode, ShareSummary } from "@/contracts/share";
import { deleteShareAction } from "@/app/admin/shares/actions";
import { Button, Dialog } from "@/components/ui";

import { formatCount } from "./format";

const MODE_LABEL: Record<ShareMode, string> = {
  public: "Public",
  password: "Password",
  magic_link: "Magic link",
};

export interface ShareRevokeDialogProps {
  /** The share to revoke, or null when the dialog is closed. */
  share: ShareSummary | null;
  onClose: () => void;
  /** Called after the action settles; the parent owns feedback and refresh. */
  onDone: (result: { ok: true } | { ok: false; error: string }) => void;
}

export function ShareRevokeDialog({ share, onClose, onDone }: ShareRevokeDialogProps) {
  const [revoking, setRevoking] = useState(false);

  const confirm = async () => {
    if (!share || revoking) {
      return;
    }

    setRevoking(true);
    const result = await deleteShareAction(share.id);
    setRevoking(false);
    onDone(result.ok ? { ok: true } : { ok: false, error: result.error });
  };

  return (
    <Dialog
      open={share !== null}
      onClose={() => {
        if (!revoking) {
          onClose();
        }
      }}
      title="Revoke this share?"
      description="The link stops working immediately. Visits, favorites, and downloads stay in analytics."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={revoking}>
            Cancel
          </Button>
          <Button variant="danger" loading={revoking} onClick={() => void confirm()}>
            Revoke share
          </Button>
        </>
      }
    >
      {share && (
        <p className="admin-empty-copy">
          <code>/s/{share.slug}</code> · {MODE_LABEL[share.mode]} ·{" "}
          {formatCount(share.visits)} visits
        </p>
      )}
    </Dialog>
  );
}
