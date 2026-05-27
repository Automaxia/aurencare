import Link from "next/link";
import { CalendarPlus, Clock } from "lucide-react";
import {
  listUpcomingSessions,
  type AgendaSession,
} from "@/lib/sessions";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AgendaPage() {
  const session = await requireSession();
  const sessions = await listUpcomingSessions(session.user.id);
  const groups = groupByDay(sessions);

  return (
    <div className="max-w-5xl mx-auto">
      <header className="flex items-end justify-between gap-6 mb-8">
        <div>
          <h1 className="font-display text-4xl text-primary">Agenda</h1>
          <p className="text-ink-muted mt-2">
            {sessions.length === 0
              ? "Nenhuma sessão agendada."
              : `${sessions.length} ${
                  sessions.length === 1 ? "sessão" : "sessões"
                } à frente.`}
          </p>
        </div>
        <Link
          href="/agenda/nova"
          className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-600 transition"
        >
          <CalendarPlus className="h-4 w-4" />
          Nova sessão
        </Link>
      </header>

      {groups.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <DayGroup key={group.key} group={group} />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="bg-white rounded-2xl shadow-soft border border-primary-100/60 p-12 text-center">
      <div className="w-12 h-12 mx-auto rounded-full bg-primary-50 text-primary flex items-center justify-center mb-4">
        <CalendarPlus className="h-5 w-5" />
      </div>
      <p className="font-display text-2xl text-ink mb-2">
        Sua agenda está vazia
      </p>
      <p className="text-sm text-ink-muted mb-6 max-w-sm mx-auto">
        Agende uma sessão para começar a organizar a semana do seu consultório.
      </p>
      <Link
        href="/agenda/nova"
        className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-600 transition"
      >
        <CalendarPlus className="h-4 w-4" />
        Agendar sessão
      </Link>
    </div>
  );
}

type DayGroup = {
  key: string;
  label: string;
  relative: string | null;
  sessions: AgendaSession[];
};

function DayGroup({ group }: { group: DayGroup }) {
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
        {group.sessions.map((s) => (
          <SessionRow key={s.id} session={s} />
        ))}
      </div>
    </section>
  );
}

function SessionRow({ session }: { session: AgendaSession }) {
  return (
    <div className="flex items-center gap-5 px-6 py-4">
      <div className="text-center w-16 shrink-0">
        <p className="font-display text-2xl text-primary leading-none">
          {formatTime(session.scheduledAt)}
        </p>
        <p className="text-[11px] text-ink-muted mt-1 inline-flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {session.durationMinutes}min
        </p>
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-medium text-ink truncate">
          {session.patient.fullName}
        </p>
        <p className="text-xs text-ink-muted">{kindLabel(session.kind)}</p>
      </div>

      <StatusBadge status={session.status} />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; tone: "primary" | "secondary" | "muted" }> = {
    scheduled: { label: "Agendada", tone: "secondary" },
    completed: { label: "Concluída", tone: "muted" },
    canceled: { label: "Cancelada", tone: "muted" },
    no_show: { label: "Não compareceu", tone: "muted" },
  };
  const info = map[status] ?? { label: status, tone: "muted" as const };
  const cls =
    info.tone === "secondary"
      ? "bg-secondary/15 text-secondary-600"
      : info.tone === "primary"
        ? "bg-primary-50 text-primary-700"
        : "bg-primary-50 text-ink-muted";

  return (
    <span
      className={`inline-flex items-center text-xs px-2.5 py-1 rounded-full ${cls}`}
    >
      {info.label}
    </span>
  );
}

function kindLabel(kind: string) {
  switch (kind) {
    case "first":
      return "Primeira sessão";
    case "return":
      return "Retorno";
    case "regular":
    default:
      return "Sessão regular";
  }
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

function groupByDay(sessions: AgendaSession[]): DayGroup[] {
  const buckets = new Map<string, AgendaSession[]>();
  for (const s of sessions) {
    const date = new Date(s.scheduledAt);
    const key = dayKey(date);
    const list = buckets.get(key) ?? [];
    list.push(s);
    buckets.set(key, list);
  }

  const today = startOfDay(new Date());
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const labelFormatter = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });

  return Array.from(buckets.entries()).map(([key, items]) => {
    const date = new Date(items[0].scheduledAt);
    const day = startOfDay(date);
    let relative: string | null = null;
    if (day.getTime() === today.getTime()) relative = "Hoje";
    else if (day.getTime() === tomorrow.getTime()) relative = "Amanhã";

    return {
      key,
      label: labelFormatter.format(date),
      relative,
      sessions: items,
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
