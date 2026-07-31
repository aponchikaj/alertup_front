import { Alert } from '../../../components/ui/feedback';
import { Button } from '../../../components/ui/button';
import { RefreshIcon } from '../../../components/ui/icons';
import { useI18n } from '../../../i18n/LanguageProvider';
import type {
  ValidationIssue,
  ValidationReport,
  ValidationSeverity,
} from '../../../apis/mapEditorApi';

/* ============================================================================
   ValidationPanel — the graph problems the backend found.
   ----------------------------------------------------------------------------
   These are safety findings (an unreachable exit, an orphan node), so an issue
   that names nodes is clickable: it selects and centres the first one, which is
   the difference between "there is a problem somewhere" and "here it is".
   ========================================================================= */

const TONES: Record<ValidationSeverity, 'danger' | 'warning' | 'info'> = {
  error: 'danger',
  warning: 'warning',
  info: 'info',
};

export interface ValidationPanelProps {
  report: ValidationReport | null;
  loading: boolean;
  onRerun: () => void;
  /** Fired with the issue's first node id, when it has one. */
  onFocusNode: (nodeId: string) => void;
}

const IssueRow = ({
  issue,
  onFocusNode,
}: {
  issue: ValidationIssue;
  onFocusNode: (nodeId: string) => void;
}) => {
  const target = issue.nodeIds?.[0];
  const body = <span className="break-words">{issue.message}</span>;

  if (!target) {
    return <Alert tone={TONES[issue.severity]}>{body}</Alert>;
  }

  return (
    <button
      type="button"
      onClick={() => onFocusNode(target)}
      className="w-full text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <Alert tone={TONES[issue.severity]}>{body}</Alert>
    </button>
  );
};

export const ValidationPanel = ({
  report,
  loading,
  onRerun,
  onFocusNode,
}: ValidationPanelProps) => {
  const { t } = useI18n();

  return (
    <section
      aria-labelledby="map-editor-validation-heading"
      className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <h2
          id="map-editor-validation-heading"
          className="text-sm font-semibold uppercase tracking-wide text-ink-muted"
        >
          {t('mapEditor.validation')}
        </h2>
        <Button variant="ghost" size="sm" onClick={onRerun} loading={loading}>
          {!loading && <RefreshIcon size={16} />}
          {t('mapEditor.validationRun')}
        </Button>
      </div>

      {report && report.issues.length === 0 && (
        <p className="text-sm text-ink-muted">{t('mapEditor.validationPassed')}</p>
      )}

      {report && report.issues.length > 0 && (
        <ul className="flex flex-col gap-2">
          {report.issues.map((issue, index) => (
            <li key={`${issue.code}-${index}`}>
              <IssueRow issue={issue} onFocusNode={onFocusNode} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default ValidationPanel;
