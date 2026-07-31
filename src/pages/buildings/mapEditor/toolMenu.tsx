import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDownIcon, CheckIcon } from '../../../components/ui/icons';
import { cn } from '../../../lib/cn';
import type { EditorTool } from './editorReducer';
import type { MapIcon } from '../../../components/ui/icons';

/* ============================================================================
   ToolMenu — one dropdown per group of editor tools.
   ----------------------------------------------------------------------------
   The editor has eleven tools. As a flat strip of buttons that is a wall of
   chips the user has to re-read on every visit; as two menus it is two words
   plus whatever is currently armed, which is the only part that changes.

   The trigger shows the ACTIVE tool when this menu owns it, and the group name
   otherwise — so at a glance you can see both which mode you are in and where
   the other tools live.

   Deliberately a plain button + list rather than a native <select>: the options
   carry icons, and a select cannot render them.
   ========================================================================= */

export interface ToolMenuItem {
  tool: EditorTool;
  labelKey: string;
  Icon: typeof MapIcon;
  /** Single-key shortcut, shown right-aligned in the menu. */
  shortcut?: string;
}

export interface ToolMenuProps {
  /** Group name, shown when none of this group's tools is active. */
  label: string;
  items: ToolMenuItem[];
  activeTool: EditorTool;
  onSelect: (tool: EditorTool) => void;
  t: (key: string) => string;
}

export const ToolMenu = ({ label, items, activeTool, onSelect, t }: ToolMenuProps) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const active = items.find((item) => item.tool === activeTool) ?? null;
  const TriggerIcon = active?.Icon;

  // Close on outside press and on Escape. Pointerdown rather than click so the
  // menu is gone before the press lands on whatever is underneath it.
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };

    document.addEventListener('pointerdown', onPointerDown);
    // Capture phase: the editor listens for Escape on window to cancel
    // gestures, and closing the menu must win over that.
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium',
          'transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
          active
            ? 'border-line-strong bg-surface-2 text-ink'
            : 'border-line text-ink-muted hover:bg-surface-hover hover:text-ink',
        )}
      >
        {TriggerIcon && <TriggerIcon size={16} />}
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
          {label}
        </span>
        {active && <span>{t(active.labelKey)}</span>}
        <ChevronDownIcon size={14} />
      </button>

      {open && (
        <ul
          id={listId}
          role="menu"
          aria-label={label}
          className={cn(
            'absolute left-0 top-full z-30 mt-1.5 min-w-56 overflow-hidden rounded-xl',
            'border border-line bg-surface p-1 shadow-lg',
          )}
        >
          {items.map(({ tool, labelKey, Icon, shortcut }) => {
            const selected = tool === activeTool;
            return (
              <li key={tool}>
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={selected}
                  onClick={() => {
                    onSelect(tool);
                    setOpen(false);
                  }}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm',
                    'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
                    selected
                      ? 'bg-surface-2 font-medium text-ink'
                      : 'text-ink-muted hover:bg-surface-hover hover:text-ink',
                  )}
                >
                  <Icon size={16} />
                  <span className="flex-1">{t(labelKey)}</span>
                  {shortcut && (
                    <kbd className="rounded border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-ink-subtle">
                      {shortcut}
                    </kbd>
                  )}
                  {selected && <CheckIcon size={14} />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default ToolMenu;
