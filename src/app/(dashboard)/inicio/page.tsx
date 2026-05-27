import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  NotebookPen,
  Users2,
} from "lucide-react";
import { listCharges, type Charge } from "@/lib/charges";
import { listGoals, type Goal } from "@/lib/goals";
import { listNotes, type Note } from "@/lib/notes";
import { listPatients, type Patient } from "@/lib/patients";
import { requireSession } from "@/lib/session";
import { listUpcomingSessions, type AgendaSession } from "@/lib/sessions";

export const dynamic = "force-dynamic";

const ATTENTION_DAYS_THRESHOLD = 14;
const GOAL_NEAR_TARGET_THRESHOLD = 80;

export default async function InicioPage() {
  const session = await requireSession();
  const psychologistId = session.user.id;
  const today = startOfDay(new Date());
  const tomorrow = addDays(today, 1);
  const weekAgo = addDays(today, -7);
  const monthRange = currentMonthRange();

  const [patients, sessions, goals, notes, charges] = await Promise.all([
    listPatients(psychologistId),
    listUpcomingSessions(psychologistId),
    listGoals(psychologistId),
    listNotes(psychologistId, { limit: 200 }),
    listCharges(psychologistId, { from: monthRange.from, to: monthRange.to }),
  ]);

  const sessionsToday = sessions.filter((s) => {
    const when = new Date(s.scheduledAt);
    return when >= today && when < tomorrow;
  });
  const nextSession = sessionsToday[0] ?? sessions[0] ?? null;

  const notesThisWeek = notes.filter((n) => new Date(n.recordedAt) >= weekAgo);
  const activePatients = patients.filter((p) => p.status === "active");

  const lastNoteByPatient = buildLastNoteMap(notes);
  const stalePatients = activePatients.filter((p) => {
    const lastAt = lastNoteByPatient.get(p.id);
    if (!lastAt) return true;
    return daysBetween(new Date(lastAt), today) > ATTENTION_DAYS_THRESHOLD;
  });

  const goalsNearTarget = goals.filter(
    (g) => g.status === "active" && g.progress >= GOAL_NEAR_TARGET_THRESHOLD,
  );

  const overdueCharges = charges.filter((c) => c.status === "overdue");
  const signals = buildSignals({
    stalePatients,
    goalsNearTarget,
    overdueCharges,
  });

  const firstName = pickFirstName(session.user.name);

  return (
    <div className="max-w-6xl mx-auto">
      <header className="mb-10">
        <p className="text-sm text-ink-muted mb-1 capitalize">
          {formatTodayLabel(today)}
        </p>
        <h1 className="font-display text-4xl text-primary leading-tight">
          {greeting()}, {firstName}
        </h1>
        <p className="text-ink-muted mt-2 max-w-lg">{buildBriefing(sessionsToday, notesThisWeek)}</p>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
        <StatCard
          icon={CalendarDays}
          label="Sessões hoje"
          value={sessionsToday.length.toString()}
          hint={
            sessionsToday.length === 0
              ? nextSession
                ? `Próxima ${formatRelativeWhen(nextSession.scheduledAt, today)}`
                : "Agenda livre"
              : `Próxima às ${formatTime(sessionsToday[0].scheduledAt)}`
          }
        />
        <StatCard
          icon={Users2}
          label="Pacientes ativos"
          value={activePatients.length.toString()}
          hint={
            patients.length === activePatients.length
              ? "Todos em acompanhamento"
              : `${patients.length - activePatients.length} fora de acompanhamento`
          }
        />
        <StatCard
          icon={NotebookPen}
          label="Anotações na semana"
          value={notesThisWeek.length.toString()}
          hint={
            notesThisWeek.length === 0
              ? "Nenhuma registrada"
              : `Última ${formatRelativeWhen(notesThisWeek[0].recordedAt, today)}`
          }
        />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel
          title="Próximas sessões"
          caption={
            sessionsToday.length === 0
              ? "Nada agendado para hoje"
              : `${sessionsToday.length} hoje`
          }
          link={{ href: "/agenda", label: "Ver agenda" }}
        >
          {sessionsToday.length === 0 ? (
            nextSession ? (
              <p className="text-sm text-ink-muted">
                A próxima sessão está marcada{" "}
                {formatRelativeWhen(nextSession.scheduledAt, today)} com{" "}
                <span className="text-ink">{nextSession.patient.fullName}</span>.
              </p>
            ) : (
              <p className="text-sm text-ink-muted">
                Você não tem sessões agendadas. Que tal aproveitar para revisar
                evoluções?
              </p>
            )
          ) : (
            <ul className="divide-y divide-primary-100/60">
              {sessionsToday.map((s) => (
                <SessionLine key={s.id} session={s} />
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Sinais da prática"
          caption="Aproveitando os 5 minutos antes da próxima"
          link={{ href: "/saude-pratica", label: "Saúde da prática" }}
        >
          {signals.length === 0 ? (
            <p className="text-sm text-ink-muted">
              Carga estável, sem sinais de atenção. Bom dia para focar nas
              sessões.
            </p>
          ) : (
            <ul className="space-y-3 text-sm">
              {signals.map((signal, idx) => (
                <SignalLine key={idx} signal={signal} />
              ))}
            </ul>
          )}
        </Panel>
      </section>
    </div>
  );
}

type Signal = {
  tone: "warning" | "info" | "ok";
  text: string;
  href: string;
};

function buildSignals({
  stalePatients,
  goalsNearTarget,
  overdueCharges,
}: {
  stalePatients: Patient[];
  goalsNearTarget: Goal[];
  overdueCharges: Charge[];
}): Signal[] {
  const out: Signal[] = [];

  if (stalePatients.length > 0) {
    out.push({
      tone: "warning",
      text: `${stalePatients.length} ${
        stalePatients.length === 1 ? "paciente" : "pacientes"
      } sem entrada de evolução há mais de ${ATTENTION_DAYS_THRESHOLD} dias.`,
      href: "/evolucao-registrada",
    });
  }

  if (goalsNearTarget.length > 0) {
    out.push({
      tone: "info",
      text: `${goalsNearTarget.length} ${
        goalsNearTarget.length === 1 ? "objetivo" : "objetivos"
      } próximos da conclusão (${GOAL_NEAR_TARGET_THRESHOLD}%+).`,
      href: "/objetivos-progresso",
    });
  }

  if (overdueCharges.length > 0) {
    out.push({
      tone: "warning",
      text: `${overdueCharges.length} ${
        overdueCharges.length === 1 ? "cobrança" : "cobranças"
      } em atraso neste mês.`,
      href: "/financeiro?status=overdue",
    });
  }

  return out;
}

function buildBriefing(
  sessionsToday: AgendaSession[],
  notesThisWeek: Note[],
): string {
  if (sessionsToday.length === 0) {
    return "Você não tem sessões agendadas para hoje. Bom momento para revisar evoluções.";
  }
  const sessionPart = `Você tem ${sessionsToday.length} ${
    sessionsToday.length === 1 ? "sessão" : "sessões"
  } hoje`;
  const notesPart =
    notesThisWeek.length === 0
      ? ""
      : `, ${notesThisWeek.length} ${
          notesThisWeek.length === 1 ? "anotação" : "anotações"
        } registradas esta semana`;
  return `${sessionPart}${notesPart}.`;
}

function Panel({
  title,
  caption,
  link,
  children,
}: {
  title: string;
  caption?: string;
  link?: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-2xl shadow-soft border border-primary-100/60 p-6">
      <header className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="font-display text-xl text-ink leading-tight">
            {title}
          </h2>
          {caption && (
            <p className="text-xs text-ink-muted mt-0.5">{caption}</p>
          )}
        </div>
        {link && (
          <Link
            href={link.href}
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            {link.label}
            <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </header>
      {children}
    </section>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-soft border border-primary-100/60 p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-ink-muted">{label}</p>
        <span className="h-8 w-8 rounded-lg bg-primary-50 text-primary flex items-center justify-center">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="font-display text-4xl text-ink leading-none tabular-nums">
        {value}
      </p>
      <p className="text-xs text-ink-muted mt-2">{hint}</p>
    </div>
  );
}

function SessionLine({ session }: { session: AgendaSession }) {
  return (
    <li className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <div className="flex items-center gap-4 min-w-0">
        <span className="font-display text-xl text-primary leading-none w-14">
          {formatTime(session.scheduledAt)}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink truncate">
            {session.patient.fullName}
          </p>
          <p className="text-xs text-ink-muted">{kindLabel(session.kind)}</p>
        </div>
      </div>
      <span className="text-[11px] text-ink-muted shrink-0">
        {session.durationMinutes}min
      </span>
    </li>
  );
}

function SignalLine({ signal }: { signal: Signal }) {
  const bullet =
    signal.tone === "warning"
      ? "bg-amber-500"
      : signal.tone === "ok"
        ? "bg-secondary"
        : "bg-primary";
  return (
    <li className="flex gap-3">
      <span className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${bullet}`} />
      <Link
        href={signal.href}
        className="text-ink hover:text-primary leading-relaxed"
      >
        {signal.text}
      </Link>
    </li>
  );
}

function buildLastNoteMap(notes: Note[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const note of notes) {
    if (!map.has(note.patient.id)) {
      map.set(note.patient.id, note.recordedAt);
    }
  }
  return map;
}

function currentMonthRange(): { from: string; to: string } {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { from: toDateString(first), to: toDateString(last) };
}

function toDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function daysBetween(a: Date, b: Date): number {
  const ms = startOfDay(b).getTime() - startOfDay(a).getTime();
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
}

const HONORIFICS = new Set([
  "dr.",
  "dra.",
  "dr",
  "dra",
  "prof.",
  "prof",
  "sr.",
  "sra.",
  "sr",
  "sra",
]);

function pickFirstName(fullName: string | null | undefined): string {
  if (!fullName) return "Doutora";
  const tokens = fullName.split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    if (!HONORIFICS.has(token.toLowerCase())) return token;
  }
  return tokens[0] ?? "Doutora";
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Bom dia";
  if (hour >= 12 && hour < 18) return "Boa tarde";
  return "Boa noite";
}

function formatTodayLabel(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(date);
}

function formatRelativeWhen(iso: string, today: Date): string {
  const date = new Date(iso);
  const day = startOfDay(date);
  const diff = Math.round(
    (day.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
  const time = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
  if (diff === 0) return `hoje às ${time}`;
  if (diff === 1) return `amanhã às ${time}`;
  if (diff === -1) return `ontem às ${time}`;
  if (diff > 0 && diff < 7) {
    const weekday = new Intl.DateTimeFormat("pt-BR", {
      weekday: "long",
    }).format(date);
    return `${weekday} às ${time}`;
  }
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function kindLabel(kind: string): string {
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
