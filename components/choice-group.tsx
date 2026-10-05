type Option = { value: string; label: string };

/** Big tap-target radio buttons. Native radios, so it works without extra JS. */
export function ChoiceGroup({
  name,
  legend,
  options,
  defaultValue,
  error,
  hint,
}: {
  name: string;
  legend: string;
  options: Option[];
  defaultValue?: string | null;
  error?: string;
  hint?: string;
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium">
        {legend}
        {hint && <span className="ml-2 font-normal text-zinc-500 dark:text-zinc-400">{hint}</span>}
      </legend>
      <div className="flex gap-2">
        {options.map((o) => (
          <label key={o.value} className="flex-1">
            <input
              type="radio"
              name={name}
              value={o.value}
              defaultChecked={defaultValue === o.value}
              className="peer sr-only"
            />
            <span className="flex h-12 cursor-pointer items-center justify-center rounded-xl border border-zinc-300 text-base font-medium transition active:scale-95 peer-checked:border-emerald-600 peer-checked:bg-emerald-700 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-600/40 dark:border-zinc-700">
              {o.label}
            </span>
          </label>
        ))}
      </div>
      {error && (
        <p role="alert" className="mt-1.5 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </fieldset>
  );
}
