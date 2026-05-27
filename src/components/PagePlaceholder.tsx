export function PagePlaceholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-4xl text-primary mb-3">{title}</h1>
      <p className="text-ink-muted leading-relaxed">{description}</p>

      <div className="mt-10 bg-white rounded-2xl border border-primary-100/60 shadow-soft p-10 text-center">
        <p className="font-display text-2xl text-ink mb-2">Em breve</p>
        <p className="text-sm text-ink-muted">
          Esta seção será desenvolvida nas próximas iterações.
        </p>
      </div>
    </div>
  );
}
