import Link from "next/link";
import { NotebookPen, Plus, X } from "lucide-react";
import { listNotes, type Note, type NoteMood } from "@/lib/notes";
import { listPatients } from "@/lib/patients";
import { requireSession } from "@/lib/session";
import { listThemes } from "@/lib/themes";
import { PatientFilter } from "./PatientFilter";

export const dynamic = "force-dynamic";

type SearchParams = { paciente?: string; tema?: string };

export default async function EvolucaoRegistradaPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireSession();
  const patientId = searchParams.paciente;
  const themeId = searchParams.tema;

  const [notes, patients, themes] = await Promise.all([
    listNotes(session.user.id, { patientId, themeId, limit: 100 }),
    listPatients(session.user.id),
    listThemes(session.user.id),
  ]);

  const filteredPatient = patientId
    ? patients.find((p) => p.id === patientId)
    : null;
  const filteredTheme = themeId
    ? themes.find((t) => t.id === themeId)
    : null;

  const groups = groupByDay(notes);
  const isPatientFiltered = Boolean(filteredPatient);

  return (
    <div className="max-w-4xl mx-auto">
      <header className="flex items-end justify-between gap-6 mb-6">
        <div>
          <h1 className="font-display text-4xl text-primary">
            Evolução Registrada
          </h1>
          <p className="text-ink-muted mt-2">
            {buildSubtitle({
              count: notes.length,
              patientName: filteredPatient?.fullName,
              themeName: filteredTheme?.name,
            })}
          </p>
        </div>
        <Link
          href="/evolucao-registrada/nova"
          className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-600 transition"
        >
          <Plus className="h-4 w-4" />
          Nova entrada
        </Link>
      </header>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        {patients.length > 0 && (
          <PatientFilter
            patients={patients.map((p) => ({
              id: p.id,
              fullName: p.fullName,
            }))}
          />
        )}
        {filteredTheme && (
          <ActiveThemeChip
            themeName={filteredTheme.name}
            patientId={patientId}
          />
        )}
      </div>

      {groups.length === 0 ? (
        <EmptyState filtered={Boolean(filteredPatient || filteredTheme)} />
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <DayGroup
              key={group.key}
              group={group}
              hidePatient={isPatientFiltered}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function buildSubtitle({
  count,
  patientName,
  themeName,
}: {
  count: number;
  patientName?: string;
  themeName?: string;
}): string {
  if (count === 0 && !patientName && !themeName) {
    return "Nenhuma entrada registrada ainda.";
  }
  const noun = count === 1 ? "entrada" : "entradas";
  const parts: string[] = [`${count} ${noun}`];
  if (patientName) parts.push(`de ${patientName}`);
  if (themeName) parts.push(`marcadas com "${themeName}"`);
  return parts.join(" ") + ".";
}

function ActiveThemeChip({
  themeName,
  patientId,
}: {
  themeName: string;
  patientId?: string;
}) {
  const clearHref = patientId
    ? `/evolucao-registrada?paciente=${patientId}`
    : "/evolucao-registrada";
  return (
    <Link
      href={clearHref}
      className="inline-flex items-center gap-1.5 text-xs bg-secondary/15 text-secondary-600 hover:bg-secondary/25 px-2.5 py-1 rounded-full transition"
    >
      Tema: {themeName}
      <X className="h-3 w-3" />
    </Link>
  );
}

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="bg-white rounded-2xl shadow-soft border border-primary-100/60 p-12 text-center">
      <div className="w-12 h-12 mx-auto rounded-full bg-primary-50 text-primary flex items-center justify-center mb-4">
        <NotebookPen className="h-5 w-5" />
      </div>
      <p className="font-display text-2xl text-ink mb-2">
        {filtered
          ? "Nenhuma entrada para este paciente"
          : "Comece a registrar a evolução"}
      </p>
      <p className="text-sm text-ink-muted mb-6 max-w-sm mx-auto">
        {filtered
          ? "Esse paciente ainda não tem entradas no histórico."
          : "Registre observações clínicas, avanços e desafios para acompanhar a jornada terapêutica."}
      </p>
      <Link
        href="/evolucao-registrada/nova"
        className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-600 transition"
      >
        <Plus className="h-4 w-4" />
        Nova entrada
      </Link>
    </div>
  );
}

type DayGroup = {
  key: string;
  label: string;
  relative: string | null;
  notes: Note[];
};

function DayGroup({
  group,
  hidePatient,
}: {
  group: DayGroup;
  hidePatient: boolean;
}) {
  return (
    <section>
      <div className="flex items-baseline gap-3 mb-3 px-1">
        {group.relative && (
          <span className="font-display text-xl text-primary leading-none">
            {group.relative}
          </span>
        )}
        <span className="text-sm text-ink-muted capitalize">{group.label}</span>
      </div>

      <div className="bg-white rounded-2xl shadow-soft border border-primary-100/60 divide-y divide-primary-100/60">
        {group.notes.map((note) => (
          <NoteEntry
            key={note.id}
            note={note}
            hidePatient={hidePatient}
          />
        ))}
      </div>
    </section>
  );
}

function NoteEntry({
  note,
  hidePatient,
}: {
  note: Note;
  hidePatient: boolean;
}) {
  return (
    <article className="px-6 py-5">
      <header className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-3 min-w-0">
          <time
            className="font-display text-lg text-primary leading-none shrink-0"
            dateTime={note.recordedAt}
          >
            {formatTime(note.recordedAt)}
          </time>
          {!hidePatient && (
            <Link
              href={`/evolucao-registrada?paciente=${note.patient.id}`}
              className="text-sm text-ink hover:text-primary truncate"
            >
              {note.patient.fullName}
            </Link>
          )}
        </div>
        {note.mood && <MoodBadge mood={note.mood as NoteMood} />}
      </header>
      <p className="text-sm text-ink leading-relaxed whitespace-pre-line">
        {note.content}
      </p>
      {note.themes.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {note.themes.map((theme) => (
            <Link
              key={theme.id}
              href={`/evolucao-registrada?tema=${theme.id}`}
              className="inline-flex items-center text-xs bg-primary-50 text-primary-700 hover:bg-primary-100 px-2 py-0.5 rounded-full transition"
            >
              {theme.name}
            </Link>
          ))}
        </div>
      )}
    </article>
  );
}

function MoodBadge({ mood }: { mood: NoteMood }) {
  const map = {
    positive: {
      label: "Avanço",
      cls: "bg-secondary/15 text-secondary-600",
    },
    neutral: {
      label: "Observação",
      cls: "bg-primary-50 text-ink-muted",
    },
    challenging: {
      label: "Desafio",
      cls: "bg-amber-50 text-amber-700",
    },
  } as const;
  const info = map[mood];
  return (
    <span
      className={`inline-flex items-center text-xs px-2.5 py-1 rounded-full shrink-0 ${info.cls}`}
    >
      {info.label}
    </span>
  );
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0",
  )}-${String(date.getDate()).padStart(2, "0")}`;
}

function groupByDay(notes: Note[]): DayGroup[] {
  const buckets = new Map<string, Note[]>();
  for (const note of notes) {
    const date = new Date(note.recordedAt);
    const key = dayKey(date);
    const list = buckets.get(key) ?? [];
    list.push(note);
    buckets.set(key, list);
  }

  const today = startOfDay(new Date());
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const labelFormatter = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });

  return Array.from(buckets.entries()).map(([key, items]) => {
    const date = new Date(items[0].recordedAt);
    const day = startOfDay(date);
    let relative: string | null = null;
    if (day.getTime() === today.getTime()) relative = "Hoje";
    else if (day.getTime() === yesterday.getTime()) relative = "Ontem";

    return {
      key,
      label: labelFormatter.format(date),
      relative,
      notes: items,
    };
  });
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
