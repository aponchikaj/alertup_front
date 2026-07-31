import { useEffect, useState, type KeyboardEvent } from 'react';
import { Button } from '../../../components/ui/button';
import { ConfirmDialog } from '../../../components/ui/confirmDialog';
import { TextAreaField, TextField } from '../../../components/ui/field';
import { Select } from '../../../components/ui/select';
import { Badge } from '../../../components/ui/feedback';
import {
  CloseIcon,
  QrCodeIcon,
  TrashIcon,
} from '../../../components/ui/icons';
import { useI18n } from '../../../i18n/LanguageProvider';
import type { NodeType } from '../../../components/map/types';
import type { EditorNode, EditorPoi } from '../../../apis/mapEditorApi';

/* ============================================================================
   NodeInspector — everything you can do to one node.
   ----------------------------------------------------------------------------
   Rendered either into the desktop side column or into a Sheet on small
   screens; it owns no layout of its own so the same markup serves both.
   ========================================================================= */

const NODE_TYPE_KEYS: Record<NodeType, string> = {
  NORMAL: 'mapEditor.typeNormal',
  ENTRANCE: 'mapEditor.typeEntrance',
  TRANSIT: 'mapEditor.typeTransit',
  POI: 'mapEditor.typePoi',
  EMERGENCY_EXIT: 'mapEditor.typeEmergencyExit',
};

export interface PoiFormValues {
  name: string;
  category: string;
  description: string;
  keywords: string[];
}

export interface NodeInspectorProps {
  node: EditorNode;
  poi: EditorPoi | null;
  /** Opens the POI section expanded (the assign-poi tool sets this). */
  poiExpanded?: boolean;
  onSaveNode: (patch: { label: string | null; type: NodeType }) => Promise<void>;
  onDeleteNode: () => Promise<void>;
  onSavePoi: (values: PoiFormValues) => Promise<void>;
  onRemovePoi: () => Promise<void>;
  onShowQr: () => void;
}

export const NodeInspector = ({
  node,
  poi,
  poiExpanded = false,
  onSaveNode,
  onDeleteNode,
  onSavePoi,
  onRemovePoi,
  onShowQr,
}: NodeInspectorProps) => {
  const { t } = useI18n();

  const [label, setLabel] = useState(node.label ?? '');
  const [type, setType] = useState<NodeType>(node.type);
  const [savingNode, setSavingNode] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [showPoi, setShowPoi] = useState(poiExpanded || poi !== null);
  const [poiForm, setPoiForm] = useState<PoiFormValues>({
    name: '',
    category: '',
    description: '',
    keywords: [],
  });
  const [keywordDraft, setKeywordDraft] = useState('');
  const [savingPoi, setSavingPoi] = useState(false);

  // Re-seed every field when the inspector is pointed at a different node —
  // otherwise the previous node's label is one click away from being saved
  // onto this one.
  useEffect(() => {
    setLabel(node.label ?? '');
    setType(node.type);
    setConfirmDelete(false);
  }, [node.id, node.label, node.type]);

  useEffect(() => {
    setPoiForm({
      name: poi?.name ?? '',
      category: poi?.category ?? '',
      description: poi?.description ?? '',
      keywords: poi?.keywords ?? [],
    });
    setKeywordDraft('');
  }, [node.id, poi]);

  useEffect(() => {
    setShowPoi(poiExpanded || poi !== null);
  }, [node.id, poiExpanded, poi]);

  const typeOptions = (Object.keys(NODE_TYPE_KEYS) as NodeType[]).map((value) => ({
    value,
    label: t(NODE_TYPE_KEYS[value]),
  }));

  const addKeyword = (raw: string) => {
    const value = raw.trim();
    if (!value) return;
    setPoiForm((f) =>
      f.keywords.includes(value) ? f : { ...f, keywords: [...f.keywords, value] },
    );
    setKeywordDraft('');
  };

  const handleKeywordKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      // Enter inside the inspector must not bubble up and submit the floors
      // form sitting in the same column.
      e.preventDefault();
      addKeyword(keywordDraft);
      return;
    }
    if (e.key === 'Backspace' && keywordDraft === '') {
      setPoiForm((f) =>
        f.keywords.length === 0 ? f : { ...f, keywords: f.keywords.slice(0, -1) },
      );
    }
  };

  return (
    <div className="flex flex-col gap-5" data-testid="node-inspector">
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{t(NODE_TYPE_KEYS[node.type])}</Badge>
        <span className="font-mono text-xs text-ink-subtle">
          {Math.round(node.x)}, {Math.round(node.y)}
        </span>
      </div>

      <div className="flex flex-col gap-3">
        <TextField
          label={t('mapEditor.nodeLabel')}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <Select
          label={t('mapEditor.nodeType')}
          options={typeOptions}
          value={type}
          onChange={(e) => setType(e.target.value as NodeType)}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            loading={savingNode}
            onClick={async () => {
              setSavingNode(true);
              try {
                await onSaveNode({ label: label.trim() === '' ? null : label.trim(), type });
              } finally {
                setSavingNode(false);
              }
            }}
          >
            {t('common.save')}
          </Button>
          <Button size="sm" variant="secondary" onClick={onShowQr}>
            <QrCodeIcon size={16} />
            {t('mapEditor.generateQr')}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-line pt-4">
        {!showPoi ? (
          <Button size="sm" variant="secondary" onClick={() => setShowPoi(true)}>
            {t('mapEditor.savePoi')}
          </Button>
        ) : (
          <>
            <TextField
              label={t('mapEditor.poiName')}
              value={poiForm.name}
              onChange={(e) => setPoiForm((f) => ({ ...f, name: e.target.value }))}
            />
            <TextField
              label={t('mapEditor.poiCategory')}
              value={poiForm.category}
              onChange={(e) => setPoiForm((f) => ({ ...f, category: e.target.value }))}
            />
            <TextAreaField
              label={t('mapEditor.poiDescription')}
              rows={3}
              value={poiForm.description}
              onChange={(e) =>
                setPoiForm((f) => ({ ...f, description: e.target.value }))
              }
            />

            <div className="flex flex-col gap-2">
              <TextField
                label={t('mapEditor.poiKeywords')}
                hint={t('mapEditor.poiKeywordsHint')}
                value={keywordDraft}
                onChange={(e) => setKeywordDraft(e.target.value)}
                onKeyDown={handleKeywordKeyDown}
                onBlur={() => addKeyword(keywordDraft)}
              />
              {poiForm.keywords.length > 0 && (
                <ul className="flex flex-wrap gap-1.5">
                  {poiForm.keywords.map((keyword) => (
                    <li key={keyword}>
                      <span className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-2 py-1 pl-3 pr-1 text-xs text-ink">
                        {keyword}
                        <button
                          type="button"
                          aria-label={`${t('common.delete')} ${keyword}`}
                          onClick={() =>
                            setPoiForm((f) => ({
                              ...f,
                              keywords: f.keywords.filter((k) => k !== keyword),
                            }))
                          }
                          className="grid h-5 w-5 place-items-center rounded-full text-ink-subtle hover:bg-surface-hover hover:text-ink"
                        >
                          <CloseIcon size={12} />
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                loading={savingPoi}
                disabled={poiForm.name.trim() === ''}
                onClick={async () => {
                  setSavingPoi(true);
                  try {
                    await onSavePoi({
                      ...poiForm,
                      name: poiForm.name.trim(),
                      keywords: poiForm.keywords,
                    });
                  } finally {
                    setSavingPoi(false);
                  }
                }}
              >
                {t('mapEditor.savePoi')}
              </Button>
              {poi && (
                <Button size="sm" variant="secondary" onClick={() => void onRemovePoi()}>
                  {t('mapEditor.removePoi')}
                </Button>
              )}
            </div>
          </>
        )}
      </div>

      <div className="border-t border-line pt-4">
        <Button
          size="sm"
          variant="danger"
          onClick={() => setConfirmDelete(true)}
        >
          <TrashIcon size={16} />
          {t('mapEditor.deleteNode')}
        </Button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={onDeleteNode}
        title={t('mapEditor.deleteNode')}
        body={t('mapEditor.deleteNodeConfirm')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        tone="danger"
      />
    </div>
  );
};

export default NodeInspector;
