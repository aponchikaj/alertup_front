import { useRef, useState } from 'react';
import { Button } from '../../../components/ui/button';
import { ConfirmDialog } from '../../../components/ui/confirmDialog';
import { TextField } from '../../../components/ui/field';
import { PlusIcon, SettingsIcon, TrashIcon } from '../../../components/ui/icons';
import { cn } from '../../../lib/cn';
import { useI18n } from '../../../i18n/LanguageProvider';
import {
  canvasSizeForMeters,
  DEFAULT_PIXELS_PER_METER,
  MAX_ROOM_METERS,
  MIN_ROOM_METERS,
} from '../../../components/map';
import type { EditorFloor, FloorInput } from '../../../apis/mapEditorApi';

/* ============================================================================
   FloorsPanel — the floor list, and the add/edit form beneath it.
   ----------------------------------------------------------------------------
   Floors are addressed by id everywhere, never by their position in the array:
   the old editor keyed the switcher on the array index, so deleting floor 1
   silently moved every node the user placed afterwards onto the wrong plan.

   A floor is created by typing how big the space actually is, in metres. That
   one input does three jobs: it sizes the blank canvas, it fixes
   scalePixelsPerMeter (so routes report real distances with no separate
   calibration step), and it means nobody has to find a floor plan file before
   they can start. Uploading an image is still possible, but it is now the
   fallback rather than the front door.
   ========================================================================= */

export interface FloorsPanelProps {
  floors: EditorFloor[];
  activeFloorId: string | null;
  onSelect: (floorId: string) => void;
  onCreate: (input: FloorInput) => Promise<boolean>;
  onUpdate: (floorId: string, input: FloorInput) => Promise<boolean>;
  onDelete: (floorId: string) => Promise<void>;
}

interface FormState {
  floorNumber: string;
  name: string;
  widthMeters: string;
  heightMeters: string;
  map: File | null;
}

const emptyForm: FormState = {
  floorNumber: '',
  name: '',
  widthMeters: '',
  heightMeters: '',
  map: null,
};

/** Metres back out of a stored canvas size, for the edit form. */
const toMeters = (units: number | null, scale: number | null): string => {
  if (!units || !scale || scale <= 0) return '';
  return String(Math.round((units / scale) * 10) / 10);
};

const parseMeters = (raw: string): number | null => {
  const n = Number(raw.trim());
  return Number.isFinite(n) && n >= MIN_ROOM_METERS && n <= MAX_ROOM_METERS ? n : null;
};

export const FloorsPanel = ({
  floors,
  activeFloorId,
  onSelect,
  onCreate,
  onUpdate,
  onDelete,
}: FloorsPanelProps) => {
  const { t } = useI18n();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<EditorFloor | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // A floor that disappears (deleted here, or by another editor) must not leave
  // the form pointing at a row that no longer exists — derived, not synced, so
  // there is no window in which a PATCH could go to a deleted id.
  const editing =
    editingId && floors.some((floor) => floor.id === editingId) ? editingId : null;

  const startEdit = (floor: EditorFloor) => {
    setEditingId(floor.id);
    setForm({
      floorNumber: String(floor.floorNumber),
      name: floor.name ?? '',
      widthMeters: toMeters(floor.width, floor.scalePixelsPerMeter),
      heightMeters: toMeters(floor.height, floor.scalePixelsPerMeter),
      map: null,
    });
    setShowUpload(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowUpload(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const widthMeters = parseMeters(form.widthMeters);
  const heightMeters = parseMeters(form.heightMeters);
  const sizeEntered = form.widthMeters.trim() !== '' || form.heightMeters.trim() !== '';
  const sizeValid = widthMeters !== null && heightMeters !== null;
  const sizeInvalid = sizeEntered && !sizeValid;

  const handleSubmit = async () => {
    setBusy(true);

    const input: FloorInput = {
      floorNumber: form.floorNumber.trim() === '' ? undefined : form.floorNumber.trim(),
      name: form.name.trim() === '' ? undefined : form.name.trim(),
      map: form.map,
    };

    // Size is optional on edit (leaving it blank keeps the existing canvas) but
    // is what turns a new floor into a drawable one.
    if (sizeValid) {
      const canvas = canvasSizeForMeters(widthMeters, heightMeters);
      input.width = canvas.width;
      input.height = canvas.height;
      input.scalePixelsPerMeter = DEFAULT_PIXELS_PER_METER;
    }

    const ok = editing ? await onUpdate(editing, input) : await onCreate(input);
    setBusy(false);
    if (ok) resetForm();
  };

  // A new floor needs a canvas to draw on — either a size, or an uploaded plan
  // that brings its own. Editing an existing floor needs neither, since it
  // already has one.
  const hasCanvas = sizeValid || form.map !== null;
  const canSubmit =
    !sizeInvalid && (editing !== null || (form.floorNumber.trim() !== '' && hasCanvas));

  const area = sizeValid ? Math.round(widthMeters * heightMeters) : null;

  return (
    <section
      aria-labelledby="map-editor-floors-heading"
      className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4"
    >
      <h2
        id="map-editor-floors-heading"
        className="text-sm font-semibold uppercase tracking-wide text-ink-muted"
      >
        {t('mapEditor.floors')}
      </h2>

      {floors.length === 0 ? (
        <p className="text-sm text-ink-muted">{t('mapEditor.noFloors')}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {floors.map((floor) => {
            const active = floor.id === activeFloorId;
            return (
              <li key={floor.id} className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onSelect(floor.id)}
                  aria-pressed={active}
                  data-testid={`floor-button-${floor.id}`}
                  className={cn(
                    'flex min-w-0 flex-1 flex-col items-start rounded-lg border px-3 py-2 text-left',
                    'transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                    active
                      ? 'border-line-strong bg-surface-2 text-ink'
                      : 'border-line text-ink-muted hover:bg-surface-hover hover:text-ink',
                  )}
                >
                  <span className="truncate text-sm font-medium">
                    {floor.name || t('wayfinding.floor', { number: floor.floorNumber })}
                  </span>
                  <span className="text-xs text-ink-subtle">
                    {t('wayfinding.floorShort', { number: floor.floorNumber })}
                    {floor.width && floor.scalePixelsPerMeter
                      ? ` · ${toMeters(floor.width, floor.scalePixelsPerMeter)}×${toMeters(
                          floor.height,
                          floor.scalePixelsPerMeter,
                        )} m`
                      : ''}
                  </span>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => startEdit(floor)}
                  aria-label={`${t('common.save')} — ${
                    floor.name || t('wayfinding.floor', { number: floor.floorNumber })
                  }`}
                >
                  <SettingsIcon size={16} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setPendingDelete(floor)}
                  aria-label={`${t('mapEditor.deleteFloor')} — ${
                    floor.name || t('wayfinding.floor', { number: floor.floorNumber })
                  }`}
                >
                  <TrashIcon size={16} />
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <form
        className="flex flex-col gap-3 border-t border-line pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit();
        }}
      >
        <p className="text-sm font-medium text-ink">
          {editing ? t('common.save') : t('mapEditor.addFloor')}
        </p>

        <TextField
          label={t('mapEditor.floorNumber')}
          type="number"
          inputMode="numeric"
          value={form.floorNumber}
          onChange={(e) => setForm((f) => ({ ...f, floorNumber: e.target.value }))}
        />
        <TextField
          label={t('mapEditor.floorName')}
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />

        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-sm font-medium text-ink">
            {t('mapEditor.roomSize')}
          </legend>
          <p className="text-xs text-ink-subtle">{t('mapEditor.roomSizeHint')}</p>
          <div className="flex items-end gap-2">
            <TextField
              label={t('mapEditor.widthMeters')}
              type="number"
              inputMode="decimal"
              min={MIN_ROOM_METERS}
              max={MAX_ROOM_METERS}
              step="any"
              className="flex-1"
              value={form.widthMeters}
              onChange={(e) => setForm((f) => ({ ...f, widthMeters: e.target.value }))}
            />
            <span aria-hidden className="pb-2.5 text-sm text-ink-subtle">
              ×
            </span>
            <TextField
              label={t('mapEditor.heightMeters')}
              type="number"
              inputMode="decimal"
              min={MIN_ROOM_METERS}
              max={MAX_ROOM_METERS}
              step="any"
              className="flex-1"
              value={form.heightMeters}
              onChange={(e) => setForm((f) => ({ ...f, heightMeters: e.target.value }))}
            />
          </div>
          {sizeInvalid ? (
            <p role="alert" className="text-xs text-danger-text">
              {t('mapEditor.roomSizeRange', {
                min: MIN_ROOM_METERS,
                max: MAX_ROOM_METERS,
              })}
            </p>
          ) : area !== null ? (
            <p className="text-xs text-ink-subtle">
              {t('mapEditor.roomArea', { area })}
            </p>
          ) : null}
        </fieldset>

        {/* Uploading a plan is still supported for buildings that already have
            one, but it is folded away so drawing is the obvious path. */}
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => setShowUpload((open) => !open)}
            aria-expanded={showUpload}
            className="self-start text-xs font-medium text-ink-muted underline underline-offset-2 hover:text-ink"
          >
            {t('mapEditor.uploadInstead')}
          </button>
          {showUpload && (
            // The toggle above already names this, so the input carries only an
            // accessible label rather than repeating it on screen.
            <input
              ref={fileRef}
              id="map-editor-floor-image"
              type="file"
              aria-label={t('mapEditor.uploadMap')}
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={(e) =>
                setForm((f) => ({ ...f, map: e.target.files?.[0] ?? null }))
              }
              className={cn(
                'w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm text-ink-muted',
                'file:mr-3 file:rounded-lg file:border-0 file:bg-surface file:px-3 file:py-1.5',
                'file:text-sm file:font-medium file:text-ink',
              )}
            />
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" loading={busy} disabled={!canSubmit}>
            {!busy && <PlusIcon size={16} />}
            {editing ? t('common.save') : t('mapEditor.addFloor')}
          </Button>
          {editing && (
            <Button type="button" size="sm" variant="secondary" onClick={resetForm}>
              {t('common.cancel')}
            </Button>
          )}
        </div>
      </form>

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={async () => {
          if (pendingDelete) await onDelete(pendingDelete.id);
        }}
        title={t('mapEditor.deleteFloor')}
        body={t('mapEditor.deleteFloorConfirm')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        tone="danger"
      />
    </section>
  );
};

export default FloorsPanel;
