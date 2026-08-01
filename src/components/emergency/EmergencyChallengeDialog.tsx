import { useCallback, useEffect, useRef, useState } from 'react';
import { get } from '../../apis/http';
import { Button } from '../ui/button';
import { Modal } from '../ui/modal';
import { Alert } from '../ui/feedback';
import { AlertTriangleIcon } from '../ui/icons';
import { useI18n } from '../../i18n/LanguageProvider';

/* ============================================================================
   EmergencyChallengeDialog — the human check on the emergency switch.
   ----------------------------------------------------------------------------
   Arming or resolving an emergency broadcasts to every phone in the building.
   Before the request goes out, the server issues a small arithmetic question;
   answering it proves a present, deliberate human — a stray tap, a double
   click or an automated replay cannot get through.

   The dialog owns the whole flow: fetch question → collect answer → hand
   {token, answer} back to the caller, which attaches it to the actual
   trigger/resolve request. A wrong answer server-side comes back through
   `serverError` and fetches a fresh question.
   ========================================================================= */

export interface EmergencyChallenge {
  token: string;
  answer: number;
}

export interface EmergencyChallengeDialogProps {
  open: boolean;
  /** True when this confirms ACTIVATION (danger framing); false = resolving. */
  activating: boolean;
  /** Error from the caller's submit (e.g. CHALLENGE_FAILED) — shown inline. */
  serverError?: string | null;
  submitting?: boolean;
  onConfirm: (challenge: EmergencyChallenge) => void;
  onClose: () => void;
}

interface IssuedChallenge {
  token: string;
  question: string;
}

export const EmergencyChallengeDialog = ({
  open,
  activating,
  serverError = null,
  submitting = false,
  onConfirm,
  onClose,
}: EmergencyChallengeDialogProps) => {
  const { t } = useI18n();
  const [issued, setIssued] = useState<IssuedChallenge | null>(null);
  const [answer, setAnswer] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchChallenge = useCallback(async () => {
    // Async gap first: the state resets happen inside the promise chain, not
    // synchronously inside the calling effect (react-hooks/set-state-in-effect).
    await Promise.resolve();
    setIssued(null);
    setAnswer('');
    setLoadError(null);
    try {
      const res = await get<{ success: boolean; data: IssuedChallenge }>(
        '/api/emergency/challenge',
      );
      setIssued(res.data);
    } catch {
      setLoadError(t('emergencyChallenge.loadFailed'));
    }
  }, [t]);

  // Deferred a tick so the effect never sets state synchronously during the
  // open/error render pass. A rejected answer means the token was burned or
  // mistyped — either way the honest next step is a fresh question.
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => void fetchChallenge(), 0);
    return () => clearTimeout(timer);
  }, [open, serverError, fetchChallenge]);

  const parsed = Number(answer.trim());
  const canSubmit = issued !== null && answer.trim() !== '' && Number.isFinite(parsed);

  const submit = () => {
    if (!issued || !canSubmit) return;
    onConfirm({ token: issued.token, answer: parsed });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        activating
          ? t('emergencyChallenge.titleActivate')
          : t('emergencyChallenge.titleResolve')
      }
      closeLabel={t('common.cancel')}
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Alert
          tone={activating ? 'danger' : 'info'}
          title={
            activating
              ? t('emergencyChallenge.warnActivate')
              : t('emergencyChallenge.warnResolve')
          }
        >
          <p className="text-sm">{t('emergencyChallenge.explain')}</p>
        </Alert>

        {serverError && <Alert tone="danger">{serverError}</Alert>}
        {loadError && (
          <Alert tone="danger">
            {loadError}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="mt-2"
              onClick={() => void fetchChallenge()}
            >
              {t('common.retry')}
            </Button>
          </Alert>
        )}

        {issued && (
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">
              {t('emergencyChallenge.question', { question: issued.question })}
            </span>
            <input
              ref={inputRef}
              type="number"
              inputMode="numeric"
              autoFocus
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              className="w-full rounded-xl border border-line bg-surface-2 px-4 py-3 text-lg font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              aria-label={t('emergencyChallenge.answerLabel')}
            />
          </label>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            variant={activating ? 'danger' : 'primary'}
            disabled={!canSubmit}
            loading={submitting}
          >
            <AlertTriangleIcon size={16} />
            {activating
              ? t('emergencyChallenge.confirmActivate')
              : t('emergencyChallenge.confirmResolve')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default EmergencyChallengeDialog;
