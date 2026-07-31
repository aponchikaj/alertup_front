import { useEffect, useRef, useState } from 'react';
import { Button } from '../../../components/ui/button';
import { ConfirmDialog } from '../../../components/ui/confirmDialog';
import { TextField } from '../../../components/ui/field';
import { Select } from '../../../components/ui/select';
import { Badge } from '../../../components/ui/feedback';
import { TrashIcon } from '../../../components/ui/icons';
import { cn } from '../../../lib/cn';
import { useI18n } from '../../../i18n/LanguageProvider';
import {
  ICON_KINDS,
  type DrawingShape,
  type IconKind,
} from '../../../components/map';
import { ICON_KIND_KEYS, SHAPE_KIND_KEYS } from './labels';

/* ============================================================================
   ShapeInspector — everything you can do to one drawn shape.
   ----------------------------------------------------------------------------
   Mirrors NodeInspector: no layout of its own, so the desktop column and the
   mobile Sheet render the same markup.

   Edits are applied straight to the shape via `onChange` (the page debounces
   the save) rather than sitting behind a Save button. A drawing is a direct-
   manipulation surface — a name that only appears after pressing Save reads as
   a bug when the box is right there on screen.
   ========================================================================= */

/** Presets rather than a colour picker: a floor plan reads better with a small
 *  shared palette, and these are the tones the map theme already uses. */
const SWATCHES = [
  '#e2e8f0',
  '#cbd5e1',
  '#bfdbfe',
  '#bbf7d0',
  '#fde68a',
  '#fecaca',
  '#e9d5ff',
  '#fed7aa',
];

export interface ShapeInspectorProps {
  shape: DrawingShape;
  /** Patch merged into the shape. Partial — only what changed. */
  onChange: (patch: Partial<DrawingShape>) => void;
  onDelete: () => void;
  /** Uploads a logo and returns its stored URL. */
  onUploadLogo: (file: File) => Promise<string | null>;
  /** Creates the routing node this shape stands for. */
  onCreateNode: () => Promise<void>;
  /** True once the shape's `nodeId` resolves to a node that still exists. */
  nodeLinked: boolean;
}

export const ShapeInspector = ({
  shape,
  onChange,
  onDelete,
  onUploadLogo,
  onCreateNode,
  nodeLinked,
}: ShapeInspectorProps) => {
  const { t } = useI18n();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [linking, setLinking] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Local mirror so typing stays responsive; the page debounces persistence.
  const [name, setName] = useState('');
  const [text, setText] = useState('');

  // Re-seed when pointed at a different shape, or the previous shape's name is
  // one keystroke away from being written onto this one.
  useEffect(() => {
    setName('name' in shape ? (shape.name ?? '') : '');
    setText(shape.kind === 'text' ? shape.text : '');
    setConfirmDelete(false);
    if (fileRef.current) fileRef.current.value = '';
  }, [shape.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const isBox = shape.kind === 'room' || shape.kind === 'shop';

  // Every marker stands for a real place, and shops are destinations — both
  // belong on the routing graph, and both therefore get a QR code.
  const canLinkNode = shape.kind === 'shop' || shape.kind === 'icon';

  const handleLogo = async (file: File) => {
    setUploading(true);
    try {
      const url = await onUploadLogo(file);
      if (url) onChange({ logoUrl: url } as Partial<DrawingShape>);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col gap-5" data-testid="shape-inspector">
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{t(SHAPE_KIND_KEYS[shape.kind])}</Badge>
        {canLinkNode && (
          <Badge tone={nodeLinked ? 'success' : 'warning'}>
            {nodeLinked ? t('mapEditor.shapeRouted') : t('mapEditor.shapeNotRouted')}
          </Badge>
        )}
      </div>

      {isBox && (
        <TextField
          label={
            shape.kind === 'shop' ? t('mapEditor.shopName') : t('mapEditor.roomName')
          }
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            onChange({ name: e.target.value.trim() || undefined } as Partial<DrawingShape>);
          }}
        />
      )}

      {/* Room and shop are the same box drawn the same way; what separates
          them is whether a tenant occupies it. So it is a switch here rather
          than two near-identical tools in the toolbar. */}
      {isBox && (
        <label className="flex items-center gap-2.5 text-sm text-ink">
          <input
            type="checkbox"
            checked={shape.kind === 'shop'}
            onChange={(e) =>
              onChange({
                kind: e.target.checked ? 'shop' : 'room',
              } as Partial<DrawingShape>)
            }
            className="h-4 w-4 rounded border-line accent-[var(--brand)]"
          />
          <span>
            {t('mapEditor.isShop')}
            <span className="block text-xs text-ink-subtle">
              {t('mapEditor.isShopHint')}
            </span>
          </span>
        </label>
      )}

      {shape.kind === 'text' && (
        <TextField
          label={t('mapEditor.shapeText')}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            onChange({ text: e.target.value } as Partial<DrawingShape>);
          }}
        />
      )}

      {shape.kind === 'icon' && (
        <>
          <Select
            label={t('mapEditor.iconKind')}
            value={shape.icon}
            onChange={(e) =>
              onChange({ icon: e.target.value as IconKind } as Partial<DrawingShape>)
            }
            options={ICON_KINDS.map((icon) => ({
              value: icon,
              label: t(ICON_KIND_KEYS[icon]),
            }))}
          />
          <TextField
            label={t('mapEditor.iconSize')}
            type="number"
            inputMode="numeric"
            min={8}
            max={200}
            value={String(shape.size)}
            onChange={(e) => {
              const size = Number(e.target.value);
              if (Number.isFinite(size) && size > 0) {
                onChange({ size } as Partial<DrawingShape>);
              }
            }}
          />
        </>
      )}

      {shape.kind === 'wall' && (
        <TextField
          label={t('mapEditor.wallThickness')}
          type="number"
          inputMode="numeric"
          min={1}
          max={60}
          value={String(shape.thickness)}
          onChange={(e) => {
            const thickness = Number(e.target.value);
            if (Number.isFinite(thickness) && thickness > 0) {
              onChange({ thickness } as Partial<DrawingShape>);
            }
          }}
        />
      )}

      {shape.kind === 'shop' && (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-ink">{t('mapEditor.shopLogo')}</span>
          {shape.logoUrl && (
            <div className="flex items-center gap-3">
              <img
                src={shape.logoUrl}
                alt=""
                className="h-12 w-12 rounded-lg border border-line object-contain"
              />
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onChange({ logoUrl: undefined } as Partial<DrawingShape>)}
              >
                {t('mapEditor.removeLogo')}
              </Button>
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            disabled={uploading}
            aria-label={t('mapEditor.shopLogo')}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleLogo(file);
            }}
            className={cn(
              'w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm text-ink-muted',
              'file:mr-3 file:rounded-lg file:border-0 file:bg-surface file:px-3 file:py-1.5',
              'file:text-sm file:font-medium file:text-ink',
            )}
          />
          {uploading && (
            <p className="text-xs text-ink-subtle">{t('mapEditor.uploadingLogo')}</p>
          )}
        </div>
      )}

      {isBox && (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-ink">
            {t('mapEditor.shapeFill')}
          </legend>
          <div className="flex flex-wrap gap-1.5">
            {SWATCHES.map((swatch) => {
              const active = shape.fill === swatch;
              return (
                <button
                  key={swatch}
                  type="button"
                  aria-label={swatch}
                  aria-pressed={active}
                  onClick={() => onChange({ fill: swatch } as Partial<DrawingShape>)}
                  style={{ background: swatch }}
                  className={cn(
                    'h-7 w-7 rounded-md border transition-transform',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                    active ? 'scale-110 border-ink' : 'border-line hover:scale-105',
                  )}
                />
              );
            })}
            <button
              type="button"
              onClick={() => onChange({ fill: undefined } as Partial<DrawingShape>)}
              className="h-7 rounded-md border border-line px-2 text-xs text-ink-muted hover:bg-surface-hover hover:text-ink"
            >
              {t('mapEditor.shapeFillDefault')}
            </button>
          </div>
        </fieldset>
      )}

      {canLinkNode && !nodeLinked && (
        <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface-2 p-3">
          <p className="text-xs text-ink-muted">{t('mapEditor.shapeNotRoutedHint')}</p>
          <Button
            size="sm"
            variant="secondary"
            loading={linking}
            onClick={async () => {
              setLinking(true);
              try {
                await onCreateNode();
              } finally {
                setLinking(false);
              }
            }}
          >
            {t('mapEditor.createRoutingNode')}
          </Button>
        </div>
      )}

      <div className="border-t border-line pt-4">
        <Button size="sm" variant="danger" onClick={() => setConfirmDelete(true)}>
          <TrashIcon size={16} />
          {t('mapEditor.deleteShape')}
        </Button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => onDelete()}
        title={t('mapEditor.deleteShape')}
        body={t('mapEditor.deleteShapeConfirm')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        tone="danger"
      />
    </div>
  );
};

export default ShapeInspector;
