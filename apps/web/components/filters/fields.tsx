import type { FilterOption } from "@/lib/explorer/list";

export const fieldClass =
  "h-8 rounded-md border border-line-strong bg-surface px-2 text-[15px] text-ink focus-visible:outline-2 focus-visible:outline-accent";

export function OptionSelect({
  label,
  name,
  value,
  options,
}: {
  label: string;
  name: string;
  value: string;
  options: FilterOption[];
}) {
  // Keep a selected value that no longer has members visible, so the form never silently drops it.
  const withSelected =
    value && !options.some((option) => option.value === value) ? [{ value, label: value, count: 0 }, ...options] : options;
  return (
    <label className="flex min-w-0 flex-col gap-1 text-[13px] text-dim">
      {label}
      <select name={name} defaultValue={value} className={fieldClass}>
        <option value="">Any</option>
        {withSelected.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label} ({option.count})
          </option>
        ))}
      </select>
    </label>
  );
}

export function EnumSelect<T extends string>({
  label,
  name,
  value,
  values,
  labels,
}: {
  label: string;
  name: string;
  value: T;
  values: readonly T[];
  labels: Record<T, string>;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-[13px] text-dim">
      {label}
      <select name={name} defaultValue={value} className={fieldClass}>
        {values.map((option) => (
          <option key={option} value={option}>
            {labels[option]}
          </option>
        ))}
      </select>
    </label>
  );
}
