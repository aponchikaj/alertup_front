import { useId, type SelectHTMLAttributes } from "react";
import { cn } from "../../lib/cn";
import { inputStyles } from "./styles";
import { Field } from "./field";
import { ChevronDownIcon } from "./icons";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "className" | "children"> {
  label?: string;
  hint?: string;
  error?: string;
  hideLabel?: boolean;
  options: SelectOption[];
  /** Rendered as a disabled empty-value option, shown until a value is chosen. */
  placeholder?: string;
  className?: string;
  selectClassName?: string;
}

interface ControlProps
  extends Omit<
    SelectProps,
    "label" | "hint" | "error" | "hideLabel" | "className"
  > {
  id: string;
  describedBy: string | undefined;
  invalid: boolean;
}

const SelectControl = ({
  id,
  describedBy,
  invalid,
  options,
  placeholder,
  selectClassName,
  ...props
}: ControlProps) => (
  <div className="relative">
    <select
      id={id}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      className={inputStyles({
        invalid,
        className: cn("cursor-pointer appearance-none pr-11", selectClassName),
      })}
      {...props}
    >
      {placeholder !== undefined && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map((option) => (
        <option key={option.value} value={option.value} disabled={option.disabled}>
          {option.label}
        </option>
      ))}
    </select>
    <ChevronDownIcon
      size={18}
      className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-ink-subtle"
    />
  </div>
);

/**
 * Styled NATIVE `<select>` — keeps the OS picker (and its mobile UX) while
 * wearing the shared input skin. With a `label` it goes through the Field
 * scaffolding; without one it renders standalone (pass `aria-label`).
 */
export const Select = ({
  label,
  hint,
  error,
  hideLabel,
  className,
  required,
  ...rest
}: SelectProps) => {
  const fallbackId = useId();

  if (label) {
    return (
      <Field
        label={label}
        hint={hint}
        error={error}
        required={required}
        hideLabel={hideLabel}
        className={className}
      >
        {({ id, describedBy, invalid }) => (
          <SelectControl
            id={id}
            describedBy={describedBy}
            invalid={invalid}
            required={required}
            {...rest}
          />
        )}
      </Field>
    );
  }

  const errorId = `${fallbackId}-error`;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <SelectControl
        id={fallbackId}
        describedBy={error ? errorId : undefined}
        invalid={Boolean(error)}
        required={required}
        {...rest}
      />
      {error && (
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

export default Select;
