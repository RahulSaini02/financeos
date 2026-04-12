"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import { Modal } from "./modal";
import { Button } from "./button";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  dangerous?: boolean;
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Delete",
  dangerous = true,
  loading = false,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title=""
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant={dangerous ? "danger" : "primary"}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col items-center text-center gap-3 py-2">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-danger)]/10">
          <AlertTriangle className="h-6 w-6 text-[var(--color-danger)]" />
        </div>
        <div>
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">
            {title}
          </p>
          {description && (
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              {description}
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
