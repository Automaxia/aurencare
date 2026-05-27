import Link from "next/link";
import { MessageCircle, Trash2, Users2 } from "lucide-react";
import { listThemes, type Theme } from "@/lib/themes";
import { requireSession } from "@/lib/session";
import { deleteThemeAction } from "./actions";
import { NewThemeForm } from "./NewThemeForm";

export const dynamic = "force-dynamic";

export default async function TemasRecorrentesPage() {
  const session = await requireSession();
  const themes = await listThemes(session.user.id);

  const used = themes.filter((t) => t.occurrenceCount > 0);
  const unused = themes.filter((t) => t.occurrenceCount === 0);

  return (
    <div className="max-w-5xl mx-auto">
      <header className="mb-6">
        <h1 className="font-display text-4xl text-primary">
          Temas Recorrentes
        </h1>
        <p className="text-ink-muted mt-2">
          {themes.length === 0
            ? "Cadastre temas para marcar suas entradas de evolução e visualizar padrões."
            : `${themes.length} ${
                themes.length === 1 ? "tema" : "temas"
              } no catálogo · ${used.length} em uso.`}
        </p>
      </header>

      <div className="mb-8">
        <NewThemeForm />
      </div>

      {themes.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-8">
          {used.length > 0 && (
            <ThemeSection
              title="Temas observados"
              caption="Ordenados por frequência"
              themes={used}
            />
          )}
          {unused.length > 0 && (
            <ThemeSection
              title="Cadastrados, ainda sem ocorrências"
              caption="Marque-os em uma nova entrada de evolução"
              themes={unused}
              dim
            />
          )}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="bg-white rounded-2xl shadow-soft border border-primary-100/60 p-12 text-center">
      <div className="w-12 h-12 mx-auto rounded-full bg-primary-50 text-primary flex items-center justify-center mb-4">
        <MessageCircle className="h-5 w-5" />
      </div>
      <p className="font-display text-2xl text-ink mb-2">
        Comece organizando seus temas
      </p>
      <p className="text-sm text-ink-muted max-w-md mx-auto">
        Temas como "Ansiedade social", "Conflito familiar" ou "Autoestima"
        ajudam a enxergar padrões ao longo do tempo. Depois de cadastrá-los,
        marque suas entradas de evolução com eles.
      </p>
    </div>
  );
}

function ThemeSection({
  title,
  caption,
  themes,
  dim,
}: {
  title: string;
  caption?: string;
  themes: Theme[];
  dim?: boolean;
}) {
  return (
    <section>
      <div className="flex items-baseline justify-between gap-3 mb-3 px-1">
        <h2 className="font-display text-xl text-ink">{title}</h2>
        {caption && <span className="text-xs text-ink-muted">{caption}</span>}
      </div>
      <div
        className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${
          dim ? "opacity-90" : ""
        }`}
      >
        {themes.map((theme) => (
          <ThemeCard key={theme.id} theme={theme} />
        ))}
      </div>
    </section>
  );
}

function ThemeCard({ theme }: { theme: Theme }) {
  const hasOccurrences = theme.occurrenceCount > 0;
  return (
    <article className="bg-white rounded-2xl shadow-soft border border-primary-100/60 p-5">
      <header className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <p className="font-medium text-ink truncate">{theme.name}</p>
          {theme.description && (
            <p className="text-sm text-ink-muted mt-1 line-clamp-2">
              {theme.description}
            </p>
          )}
        </div>
        <form action={deleteThemeAction.bind(null, theme.id)}>
          <button
            type="submit"
            aria-label={`Remover tema ${theme.name}`}
            className="text-ink-muted hover:text-red-600 transition p-1 rounded-md"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </form>
      </header>

      <dl className="flex items-center gap-6 mt-4 text-xs text-ink-muted">
        <Stat
          label="Ocorrências"
          value={theme.occurrenceCount.toString()}
          highlight={hasOccurrences}
        />
        <Stat
          icon={<Users2 className="h-3.5 w-3.5" />}
          label="Pacientes"
          value={theme.patientCount.toString()}
        />
        <Stat
          label="Última"
          value={
            theme.lastRecordedAt ? formatRelativeDate(theme.lastRecordedAt) : "—"
          }
        />
      </dl>

      {hasOccurrences && (
        <div className="mt-4 pt-3 border-t border-primary-100/60">
          <Link
            href={`/evolucao-registrada?tema=${theme.id}`}
            className="text-xs text-primary hover:underline"
          >
            Ver entradas marcadas →
          </Link>
        </div>
      )}
    </article>
  );
}

function Stat({
  label,
  value,
  icon,
  highlight,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-ink-muted">
        {icon}
        {label}
      </span>
      <span
        className={`font-display text-lg leading-none mt-0.5 ${
          highlight ? "text-primary" : "text-ink"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  }).format(date);
}
