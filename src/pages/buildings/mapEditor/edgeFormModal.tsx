import { useState } from 'react';
import { Button } from '../../../components/ui/button';
import { Modal } from '../../../components/ui/modal';
import { Select } from '../../../components/ui/select';
import { TextField } from '../../../components/ui/field';
import { useI18n } from '../../../i18n/LanguageProvider';
import type { TransitType } from '../../../components/map/types';

/* ============================================================================
   EdgeFormModal — the form that finishes a two-click connection.
   ----------------------------------------------------------------------------
   Used for both same-floor edges and cross-floor transit links. `lockTransit`
   drops WALKWAY from the options for the cross-floor case, because the backend
   rejects it with a 422 — better to make it unpickable than to explain the
   rejection afterwards.

   The page mounts this only while a connection is pending, so the fields reset
   by unmounting: carrying the previous connection's cost override into the next
   one would silently corrupt routing.
   ========================================================================= */

export interface EdgeFormValues {
  transitType: TransitType;
  accessible: boolean;
  /** null means "let the server derive the cost from the distance". */
  weight: number | null;
}

export interface EdgeFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: EdgeFormValues) => void | Promise<void>;
  /** Hides WALKWAY — a cross-floor link must be a real vertical transit. */
  lockTransit?: boolean;
  /** Names of the two endpoints, shown as the dialog description. */
  description?: string;
  submitting?: boolean;
}

const VERTICAL_TRANSITS: TransitType[] = ['STAIRS', 'ELEVATOR', 'ESCALATOR'];

export const EdgeFormModal = ({
  open,
  onClose,
  onSubmit,
  lockTransit = false,
  description,
  submitting = false,
}: EdgeFormModalProps) => {
  const { t } = useI18n();
  const [transitType, setTransitType] = useState<TransitType>(
    lockTransit ? 'STAIRS' : 'WALKWAY',
  );
  const [accessible, setAccessible] = useState(true);
  const [weight, setWeight] = useState('');

  const options = (lockTransit
    ? VERTICAL_TRANSITS
    : (['WALKWAY', ...VERTICAL_TRANSITS] as TransitType[])
  ).map((value) => ({
    value,
    label: t(
      `wayfinding.transit${value.charAt(0)}${value.slice(1).toLowerCase()}`,
    ),
  }));

  const handleSubmit = () => {
    const parsed = Number(weight);
    void onSubmit({
      transitType,
      accessible,
      weight: weight.trim() !== '' && Number.isFinite(parsed) ? parsed : null,
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('mapEditor.saveEdge')}
      description={description}
      size="sm"
      closeLabel={t('common.cancel')}
    >
      <div className="flex flex-col gap-4">
        <Select
          label={t('mapEditor.edgeTransitType')}
          options={options}
          value={transitType}
          onChange={(e) => setTransitType(e.target.value as TransitType)}
        />

        <label className="flex items-center gap-3 text-sm font-medium text-ink">
          <input
            type="checkbox"
            checked={accessible}
            onChange={(e) => setAccessible(e.target.checked)}
            className="h-4 w-4 rounded border-line-strong accent-ink"
          />
          {t('mapEditor.edgeAccessible')}
        </label>

        <TextField
          label={t('mapEditor.edgeWeight')}
          type="number"
          inputMode="decimal"
          min={0}
          step="any"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
        />

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="button" onClick={handleSubmit} loading={submitting}>
            {t('mapEditor.saveEdge')}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default EdgeFormModal;
