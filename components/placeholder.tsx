export function Placeholder({
  title,
  phase,
  children,
}: {
  title: string;
  phase: number;
  children?: React.ReactNode;
}) {
  return (
    <section>
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      {children}
      <p className="mt-4 rounded-xl border border-dashed border-zinc-300 p-4 text-sm text-zinc-500 dark:text-zinc-400 dark:border-zinc-700">
        Coming in Phase {phase}.
      </p>
    </section>
  );
}
