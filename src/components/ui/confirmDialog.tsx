import { useEffect, useState, type ReactNode } from "react";
import { Button } from "./button";
import { TextField } from "./field";
import { Modal, type ModalSize } from "./modal";

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  /** May be async — the confirm button shows a spinner until it settles. */
  onConfirm: () => void | Promise<void>;
  title: string;
  body?: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  tone?: "danger" | "default";
  /**
   * When set, a text field is rendered and confirm stays disabled until the
   * user types this exact string — for destructive, irreversible operations.
   */
  requireText?: string;
  /** Label for the type-to-confirm field. Defaults to the required string. */
  requireTextLabel?: string;
  /** Announced on the confirm button while the async action runs. */
  loadingLabel?: string;
  size?: ModalSize;
}

/**
 * Confirmation dialog on top of Modal. Closes itself after `onConfirm`
 * resolves; if `onConfirm` throws, the dialog stays open so the caller can
 * surface the error (e.g. via a toast).
 */
export const ConfirmDialog = ({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel,
  cancelLabel,
  tone = "default",
  requireText,
  requireTextLabel,
  loadingLabel,
  size = "sm",
}: ConfirmDialogProps) => {
  const [busy, setBusy] = useState(false);
  const [typed, setTyped] = useState("");

  // Fresh state on every open — a previous confirmation must not pre-fill
  // the type-to-confirm field of the next dangerous operation.
  useEffect(() => {
    if (open) {
      setBusy(false);
      setTyped("");
    }
  }, [open]);

  const confirmBlocked = Boolean(requireText) && typed !== requireText;

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
      onClose();
    } catch {
      // Caller-side failure: keep the dialog open for another attempt.
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size={size}
      closeOnScrim={!busy}
    >
      <div className="flex flex-col gap-4">
        {body && <div className="text-sm text-ink-muted">{body}</div>}

        {requireText && (
          <TextField
            label={requireTextLabel ?? requireText}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            disabled={busy}
          />
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={busy}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={tone === "danger" ? "danger" : "primary"}
            onClick={handleConfirm}
            loading={busy}
            loadingLabel={loadingLabel}
            disabled={confirmBlocked}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmDialog;
