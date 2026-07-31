import {
  useId,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "../../lib/cn";
import { inputStyles } from "./styles";
import { EyeIcon, EyeOffIcon } from "./icons";

interface FieldShellProps {
  label: string;
  /** Persistent guidance. Survives focus, unlike a placeholder. */
  hint?: string;
  error?: string;
  required?: boolean;
  /** Hide the label visually but keep it for screen readers. */
  hideLabel?: boolean;
  className?: string;
  children: (ids: {
    id: string;
    describedBy: string | undefined;
    invalid: boolean;
  }) => ReactNode;
}

/**
 * Wraps a control with the label / hint / error scaffolding, and wires up the
 * aria plumbing so the hint and the error are actually announced.
 */
export const Field = ({
  label,
  hint,
  error,
  required,
  hideLabel,
  className,
  children,
}: FieldShellProps) => {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label
        htmlFor={id}
        className={cn(
          "text-sm font-medium text-ink",
          hideLabel && "sr-only",
        )}
      >
        {label}
        {required && (
          <span className="ml-1 text-danger-text" aria-hidden="true">
            *
          </span>
        )}
      </label>

      {hint && (
        <p id={hintId} className="text-xs text-ink-subtle">
          {hint}
        </p>
      )}

      {children({ id, describedBy, invalid: Boolean(error) })}

      {error && (
        /* role=alert so the message reaches assistive tech the moment it renders */
        <p
          id={errorId}
          role="alert"
          className="flex items-start gap-1.5 text-xs font-medium text-danger-text"
        >
          {error}
        </p>
      )}
    </div>
  );
};

type BaseInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "className">;

export interface TextFieldProps extends BaseInputProps {
  label: string;
  hint?: string;
  error?: string;
  hideLabel?: boolean;
  className?: string;
  inputClassName?: string;
}

export const TextField = ({
  label,
  hint,
  error,
  hideLabel,
  className,
  inputClassName,
  required,
  ...props
}: TextFieldProps) => (
  <Field
    label={label}
    hint={hint}
    error={error}
    required={required}
    hideLabel={hideLabel}
    className={className}
  >
    {({ id, describedBy, invalid }) => (
      <input
        id={id}
        required={required}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className={inputStyles({ invalid, className: inputClassName })}
        {...props}
      />
    )}
  </Field>
);

export interface PasswordFieldProps extends Omit<BaseInputProps, "type"> {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
}

export const PasswordField = ({
  label,
  hint,
  error,
  className,
  required,
  ...props
}: PasswordFieldProps) => {
  const [visible, setVisible] = useState(false);

  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      required={required}
      className={className}
    >
      {({ id, describedBy, invalid }) => (
        <div className="relative">
          <input
            id={id}
            type={visible ? "text" : "password"}
            required={required}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            className={inputStyles({ invalid, className: "pr-12" })}
            {...props}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Hide password" : "Show password"}
            aria-pressed={visible}
            className={cn(
              "absolute right-1.5 top-1/2 -translate-y-1/2",
              "grid h-9 w-9 place-items-center rounded-lg",
              "text-ink-subtle transition-colors hover:bg-surface-hover hover:text-ink",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            )}
          >
            {visible ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
          </button>
        </div>
      )}
    </Field>
  );
};

export interface TextAreaFieldProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className"> {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  textareaClassName?: string;
}

export const TextAreaField = ({
  label,
  hint,
  error,
  className,
  textareaClassName,
  required,
  rows = 5,
  ...props
}: TextAreaFieldProps) => (
  <Field
    label={label}
    hint={hint}
    error={error}
    required={required}
    className={className}
  >
    {({ id, describedBy, invalid }) => (
      <textarea
        id={id}
        rows={rows}
        required={required}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className={inputStyles({
          invalid,
          className: cn("resize-y leading-relaxed", textareaClassName),
        })}
        {...props}
      />
    )}
  </Field>
);

export default TextField;
