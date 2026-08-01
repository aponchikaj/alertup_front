import { useEffect, useRef, useState } from 'react';
import { post } from '../../../apis/http';
import { Button } from '../../../components/ui/button';
import { Sheet } from '../../../components/ui/sheet';
import { Alert, Badge } from '../../../components/ui/feedback';
import { PenIcon, RouteIcon, SpinnerIcon, ZapIcon } from '../../../components/ui/icons';
import { SketchBoard } from './sketchBoard';
import { summarizeSketch, type SketchSize, type SketchStroke } from './sketchSummary';
import { cn } from '../../../lib/cn';
import { useI18n } from '../../../i18n/LanguageProvider';
import type { FloorDrawing } from '../../../components/map';

/* ============================================================================
   Editor AI panel — design floors by asking.
   ----------------------------------------------------------------------------
   Chat drawer inside the map editor. Two kinds of answer come back:

     prose    — advice, planning, validator explanations
     drawing  — a complete floor plan the model designed, already validated
                server-side by the same rules as hand-drawn plans

   A drawing is never applied silently: it arrives as a card with an explicit
   "Apply to floor" button, and applying goes through the editor's normal
   undo-able edit path — one Ctrl+Z and the AI's idea is gone. The designer
   half is a paid-plan feature; the server flags availability and this panel
   explains rather than hides.
   ========================================================================= */

interface AiMessage {
  role: 'user' | 'assistant';
  content: string;
  drawing?: FloorDrawing | null;
  /** Editor actions the assistant proposed; the user runs them by tapping. */
  actions?: string[];
  mode?: 'replace' | 'improve';
}

interface AssistResponse {
  success: boolean;
  data: {
    reply: string;
    drawing: FloorDrawing | null;
    designAllowed: boolean;
    actions?: string[];
    /** 'improve' = additions merged around locked hand-drawn work. */
    mode?: 'replace' | 'improve';
  };
}

export interface EditorAiPanelProps {
  open: boolean;
  onClose: () => void;
  buildingId: string;
  floorId: string | null;
  /** Applies a generated drawing through the undo-able edit path. */
  onApplyDrawing: (drawing: FloorDrawing) => void;
  /** Runs an allow-listed editor action the assistant proposed. */
  onRunAction?: (action: string) => void;
  /** "+" attachment: the image becomes the floor's background underlay. */
  onAttachImage?: (file: File) => Promise<boolean>;
  /** Active floor canvas — sketches scale into these coordinates. */
  space: SketchSize;
}

/** The server keeps the last few turns; older context costs more than it adds. */
const MAX_SENT_MESSAGES = 6;

export const EditorAiPanel = ({
  open,
  onClose,
  buildingId,
  floorId,
  onApplyDrawing,
  onRunAction,
  onAttachImage,
  space,
}: EditorAiPanelProps) => {
  const { t, lang } = useI18n();
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [designAllowed, setDesignAllowed] = useState<boolean | null>(null);
  const [attaching, setAttaching] = useState(false);
  const [plusOpen, setPlusOpen] = useState(false);
  const [sketchOpen, setSketchOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const submitSketch = (strokes: SketchStroke[], board: SketchSize) => {
    const summary = summarizeSketch(strokes, board, space);
    if (!summary) return;
    // The user's typed note (if any) rides along as the intent; the sketch
    // block is the geometry the model plans from.
    const note = draft.trim() || t('editorAi.sketchDefaultPrompt');
    void sendMessage(`${note}\n\n${summary}`);
  };

  const attach = async (file: File) => {
    if (!onAttachImage) return;
    setAttaching(true);
    try {
      const okUpload = await onAttachImage(file);
      if (okUpload) {
        // The assistant sees this note in the next turn's history, so it can
        // plan around the underlay the user just added.
        setMessages((current) => [
          ...current,
          { role: 'assistant', content: t('editorAi.imageAdded') },
        ]);
      }
    } finally {
      setAttaching(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, busy]);

  const send = async () => {
    const content = draft.trim();
    if (!content || busy) return;
    await sendMessage(content);
  };

  const sendMessage = async (content: string) => {
    if (!content || busy) return;
    setDraft('');
    setError(null);
    const next: AiMessage[] = [...messages, { role: 'user', content }];
    setMessages(next);
    setBusy(true);
    try {
      const res = await post<AssistResponse>('/api/ai/editor', {
        buildingId,
        floorId,
        locale: lang,
        // History hygiene: a turn that carried a drawing is replaced by a
        // stub (the JSON already lives on the floor, not in the transcript),
        // and long prose is clipped — resending a full design summary tripped
        // the server's per-message cap and 422'd the whole request.
        messages: next.slice(-MAX_SENT_MESSAGES).map((m) => ({
          role: m.role,
          content: (m.drawing ? '[applied a floor design]' : m.content).slice(0, 1500),
        })),
      });
      const data = res?.data;
      if (!data) throw new Error('empty');
      setDesignAllowed(data.designAllowed);
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: data.reply,
          drawing: data.drawing,
          actions: data.actions,
          mode: data.mode,
        },
      ]);
    } catch {
      setError(t('editorAi.failed'));
      // Give the user their words back rather than swallowing them.
      setMessages((current) => current.slice(0, -1));
      setDraft(content);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('editorAi.title')}
      closeLabel={t('common.cancel')}
    >
      <div className="flex h-full min-h-0 flex-col gap-3">
        <p className="text-sm text-ink-muted">{t('editorAi.lead')}</p>

        {designAllowed === false && (
          <Alert tone="info">{t('editorAi.upgradeNote')}</Alert>
        )}

        <div
          ref={scrollRef}
          className="flex min-h-48 flex-1 flex-col gap-3 overflow-y-auto rounded-xl border border-line bg-surface-2 p-3"
          aria-live="polite"
        >
          {messages.length === 0 && (
            <div className="flex flex-col gap-2">
              {(['s1', 's2', 's3'] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setDraft(t(`editorAi.${key}`))}
                  className="rounded-lg border border-line bg-surface px-3 py-2 text-left text-sm text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {t(`editorAi.${key}`)}
                </button>
              ))}
            </div>
          )}

          {messages.map((message, index) => (
            <div
              key={index}
              className={cn(
                'max-w-[92%] rounded-xl px-3 py-2 text-sm leading-relaxed',
                message.role === 'user'
                  ? 'self-end bg-surface text-ink shadow-sm'
                  : 'self-start border border-line bg-surface text-ink',
              )}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
              {message.actions?.map((action) =>
                onRunAction ? (
                  <Button
                    key={action}
                    size="sm"
                    variant="secondary"
                    className="mt-2"
                    onClick={() => onRunAction(action)}
                  >
                    <RouteIcon size={15} />
                    {t(`editorAi.action_${action.replace(/-/g, '_')}`)}
                  </Button>
                ) : null,
              )}
              {message.drawing && (
                <div className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-line bg-surface-2 p-2.5">
                  <span className="flex min-w-0 flex-col gap-0.5 text-xs font-medium text-ink">
                    <span className="flex items-center gap-1.5">
                      <Badge tone="brand">
                        {message.mode === 'improve'
                          ? t('editorAi.improveReady')
                          : t('editorAi.designReady')}
                      </Badge>
                      {t('editorAi.shapeCount', {
                        count: message.drawing.shapes.length,
                      })}
                    </span>
                    {message.mode === 'improve' && (
                      <span className="text-[11px] font-normal text-ink-subtle">
                        {t('editorAi.improveNote')}
                      </span>
                    )}
                  </span>
                  <Button
                    size="sm"
                    onClick={() => {
                      onApplyDrawing(message.drawing as FloorDrawing);
                      onClose();
                    }}
                  >
                    {t('editorAi.apply')}
                  </Button>
                </div>
              )}
            </div>
          ))}

          {busy && (
            <div
              role="status"
              className="flex items-center gap-2 self-start text-sm text-ink-muted"
            >
              <SpinnerIcon size={16} />
              {t('editorAi.thinking')}
            </div>
          )}
        </div>

        {error && <Alert tone="danger">{error}</Alert>}

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <div className="relative">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              aria-hidden
              tabIndex={-1}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void attach(file);
              }}
            />
            <Button
              type="button"
              variant="secondary"
              size="icon"
              loading={attaching}
              aria-haspopup="menu"
              aria-expanded={plusOpen}
              onClick={() => setPlusOpen((v) => !v)}
              aria-label={t('editorAi.plusLabel')}
            >
              +
            </Button>
            {plusOpen && (
              <div
                role="menu"
                aria-label={t('editorAi.plusLabel')}
                className="absolute bottom-full left-0 z-30 mb-1.5 w-56 overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-lg"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setPlusOpen(false);
                    setSketchOpen(true);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-ink-muted hover:bg-surface-hover hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                >
                  <PenIcon size={16} />
                  {t('editorAi.sketchTitle')}
                </button>
                {onAttachImage && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setPlusOpen(false);
                      fileRef.current?.click();
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-ink-muted hover:bg-surface-hover hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                  >
                    <ZapIcon size={16} />
                    {t('editorAi.attach')}
                  </button>
                )}
              </div>
            )}
          </div>
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t('editorAi.placeholder')}
            aria-label={t('editorAi.placeholder')}
            className="min-h-11 w-full rounded-xl border border-line bg-surface-2 px-3.5 text-sm text-ink placeholder:text-ink-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          />
          <Button type="submit" disabled={!draft.trim() || busy} aria-label={t('editorAi.send')}>
            <ZapIcon size={16} />
            {t('editorAi.send')}
          </Button>
        </form>
      </div>

      <SketchBoard
        open={sketchOpen}
        onClose={() => setSketchOpen(false)}
        space={space}
        onSubmit={submitSketch}
      />
    </Sheet>
  );
};

export default EditorAiPanel;
