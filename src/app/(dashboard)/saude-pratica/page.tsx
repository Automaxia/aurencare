import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CircleDollarSign,
  Target,
  Users2,
} from "lucide-react";
import {
  formatCurrencyCents,
  listCharges,
  type Charge,
} from "@/lib/charges";
import { listGoals, type Goal } from "@/lib/goals";
import { listNotes, type Note } from "@/lib/notes";
import { listPatients, type Patient } from "@/lib/patients";
import { requireSession } from "@/lib/session";
import { listUpcomingSessions, type AgendaSession } from "@/lib/sessions";
import { listThemes, type Theme } from "@/lib/themes";

export const dynamic = "force-dynamic";

const ATTENTION_DAYS_THRESHOLD = 14;
const GOAL_NEAR_TARGET_THRESHOLD = 80;

export default async function SaudePraticaPage() {
  const session = await requireSession();
  const psychologistId = session.user.id;
  const monthRange = currentMonthRange();
  const today = startOfDay(new Date());
  const weekEnd = addDays(today, 7);

  const [patients, sessions, goals, notes, themes, charges] =
    await Promise.all([
      listPatients(psychologistId),
      listUpcomingSessions(psychologistId),
      listGoals(psychologistId),
      listNotes(psychologistId, { limit: 200 }),
      listThemes(psychologistId),
      listCharges(psychologistId, { from: monthRange.from, to: monthRange.to }),
    ]);

  const activePatients = patients.filter((p) => p.status === "active");
  const sessionsThisWeek = sessions.filter(
    (s) => new Date(s.scheduledAt) <= weekEnd,
  );
  const activeGoals = goals.filter((g) => g.status === "active");
  const avgGoalProgress =
    activeGoals.length === 0
      ? 0
      : Math.round(
          activeGoals.reduce((sum, g) => sum + g.progress, 0) /
            activeGoals.length,
        );

  const lastNoteByPatient = buildLastNoteMap(notes);
  const patientsNeedingAttention = collectPatientsNeedingAttention(
    activePatients,
    lastNoteByPatient,
    today,
  );

  const goalsNearTarget = activeGoals
    .filter((g) => g.progress >= GOAL_NEAR_TARGET_THRESHOLD)
    .sort((a, b) => b.progress - a.progress)
    .slice(0, 5);

  const finance = summarizeCharges(charges);
  const topThemes = themes
    .filter((t) => t.occurrenceCount > 0)
    .slice(0, 5);

  return (
    <div className="max-w-6xl mx-auto">
      <header className="mb-8">
        <p className="text-sm text-ink-muted mb-1 capitalize">
          {formatTodayLabel(today)}
        </p>
        <h1 className="font-display text-4xl text-primary">
          Saúde da Prática
        </h1>
        <p className="text-ink-muted mt-2 max-w-2xl">
          Como o seu consultório está esta semana e neste mês — sinais para
          ajustar a rotina antes de virar sobrecarga.
        </p>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
        <StatCard
          icon={CalendarDays}
          label="Sessões esta semana"
          value={sessionsThisWeek.length.toString()}
          hint={
            sessionsThisWeek.length === 0
              ? "Agenda livre"
              : `Próxima ${formatRelativeWhen(sessionsThisWeek[0]?.scheduledAt)}`
          }
        />
        <StatCard
          icon={Users2}
          label="Pacientes ativos"
          value={activePatients.length.toString()}
          hint={`${patients.length} no total`}
        />
        <StatCard
          icon={Target}
          label="Objetivos ativos"
          value={activeGoals.length.toString()}
          hint={
            activeGoals.length === 0
              ? "Nenhum em andamento"
              : `Progresso médio ${avgGoalProgress}%`
          }
          tone="primary"
        />
        <StatCard
          icon={CircleDollarSign}
          label="Recebido no mês"
          value={formatCurrencyCents(finance.paidCents)}
          hint={
            finance.openCents > 0
              ? `${formatCurrencyCents(finance.openCents)} em aberto`
              : "Tudo em dia"
          }
          tone={finance.overdueCount > 0 ? "warning" : "secondary"}
        />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-10">
        <Panel
          className="lg:col-span-3"
          title="Próximas sessões"
          caption={`${sessionsThisWeek.length} nos próximos 7 dias`}
          link={{ href: "/agenda", label: "Ver agenda" }}
        >
          {sessionsThisWeek.length === 0 ? (
            <EmptyLine>Nenhuma sessão agendada para esta semana.</EmptyLine>
          ) : (
            <ul className="divide-y divide-primary-100/60">
              {sessionsThisWeek.slice(0, 5).map((s) => (
                <SessionLine key={s.id} session={s} />
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          className="lg:col-span-2"
          title="Pontos de atenção"
          caption="Sinais que merecem um olhar"
        >
          <ul className="space-y-4 text-sm">
            <AttentionItem
              tone={patientsNeedingAttention.length > 0 ? "warning" : "ok"}
              label="Pacientes sem evolução"
              detail={
                patientsNeedingAttention.length === 0
                  ? "Todos com entrada recente."
                  : `${patientsNeedingAttention.length} sem registro há mais de ${ATTENTION_DAYS_THRESHOLD} dias.`
              }
            >
              {patientsNeedingAttention.slice(0, 3).map((entry) => (
                <li key={entry.patient.id} className="text-xs text-ink-muted">
                  · {entry.patient.fullName}
                  {entry.lastNoteAt
                    ? ` — última há ${daysBetween(new Date(entry.lastNoteAt), new Date())} dias`
                    : " — sem nenhum registro"}
                </li>
              ))}
            </AttentionItem>

            <AttentionItem
              tone={goalsNearTarget.length > 0 ? "info" : "muted"}
              label="Objetivos perto da meta"
              detail={
                goalsNearTarget.length === 0
                  ? "Nenhum objetivo acima de 80% hoje."
                  : `${goalsNearTarget.length} acima de ${GOAL_NEAR_TARGET_THRESHOLD}%.`
              }
            >
              {goalsNearTarget.slice(0, 3).map((g) => (
                <li key={g.id} className="text-xs text-ink-muted">
                  · {g.patient.fullName} — {g.title} ({g.progress}%)
                </li>
              ))}
            </AttentionItem>

            <AttentionItem
              tone={finance.overdueCount > 0 ? "warning" : "ok"}
              label="Cobranças atrasadas"
              detail={
                finance.overdueCount === 0
                  ? "Nenhuma cobrança em atraso."
                  : `${finance.overdueCount} ${
                      finance.overdueCount === 1 ? "cobrança" : "cobranças"
                    } · ${formatCurrencyCents(finance.overdueCents)}.`
              }
            />
          </ul>
        </Panel>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Panel
          className="lg:col-span-3"
          title="Temas em alta"
          caption="Mais frequentes na sua prática"
          link={{ href: "/temas-recorrentes", label: "Ver temas" }}
        >
          {topThemes.length === 0 ? (
            <EmptyLine>
              Marque temas em entradas de evolução para enxergar padrões.
            </EmptyLine>
          ) : (
            <ul className="space-y-2.5">
              {topThemes.map((theme) => (
                <ThemeLine key={theme.id} theme={theme} />
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          className="lg:col-span-2"
          title="Resumo financeiro do mês"
          caption={monthRange.label}
          link={{ href: "/financeiro", label: "Abrir financeiro" }}
        >
          <dl className="space-y-3 text-sm">
            <FinanceRow
              label="Esperado"
              value={formatCurrencyCents(finance.expectedCents)}
            />
            <FinanceRow
              label="Recebido"
              value={formatCurrencyCents(finance.paidCents)}
              tone="secondary"
            />
            <FinanceRow
              label="Em aberto"
              value={formatCurrencyCents(finance.openCents - finance.overdueCents)}
            />
            <FinanceRow
              label="Atrasado"
              value={formatCurrencyCents(finance.overdueCents)}
              tone={finance.overdueCents > 0 ? "warning" : "muted"}
            />
          </dl>
        </Panel>
      </section>
    </div>
  );
}

function Panel({
  title,
  caption,
  link,
  className,
  children,
}: {
  title: string;
  caption?: string;
  link?: { href: string; label: string };
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`bg-white rounded-2xl shadow-soft border border-primary-100/60 p-6 ${className ?? ""}`}
    >
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
  tone = "muted",
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
  hint: string;
  tone?: "primary" | "secondary" | "warning" | "muted";
}) {
  const accent =
    tone === "secondary"
      ? "bg-secondary/15 text-secondary-600"
      : tone === "warning"
        ? "bg-amber-50 text-amber-700"
        : tone === "primary"
          ? "bg-primary-50 text-primary"
          : "bg-primary-50 text-ink-muted";

  return (
    <div className="bg-white rounded-2xl shadow-soft border border-primary-100/60 p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-ink-muted">{label}</p>
        <span
          className={`h-8 w-8 rounded-lg flex items-center justify-center ${accent}`}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="font-display text-3xl text-ink leading-none tabular-nums">
        {value}
      </p>
      <p className="text-xs text-ink-muted mt-2">{hint}</p>
    </div>
  );
}

function SessionLine({ session }: { session: AgendaSession }) {
  return (
    <li className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
      <div className="text-center w-16 shrink-0">
        <p className="font-display text-lg text-primary leading-none">
          {formatTime(session.scheduledAt)}
        </p>
        <p className="text-[11px] text-ink-muted mt-0.5">
          {formatShortDate(session.scheduledAt)}
        </p>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink truncate">
          {session.patient.fullName}
        </p>
        <p className="text-xs text-ink-muted">{kindLabel(session.kind)}</p>
      </div>
    </li>
  );
}

function AttentionItem({
  tone,
  label,
  detail,
  children,
}: {
  tone: "ok" | "info" | "warning" | "muted";
  label: string;
  detail: string;
  children?: React.ReactNode;
}) {
  const bullet =
    tone === "warning"
      ? "bg-amber-500"
      : tone === "ok"
        ? "bg-secondary"
        : tone === "info"
          ? "bg-primary"
          : "bg-primary-200";

  return (
    <li className="flex gap-3">
      <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${bullet}`} />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-ink text-sm">{label}</p>
        <p className="text-xs text-ink-muted">{detail}</p>
        {children && <ul className="mt-1.5 space-y-0.5">{children}</ul>}
      </div>
    </li>
  );
}

function ThemeLine({ theme }: { theme: Theme }) {
  return (
    <li className="flex items-center justify-between gap-3">
      <Link
        href={`/evolucao-registrada?tema=${theme.id}`}
        className="text-sm text-ink hover:text-primary truncate"
      >
        {theme.name}
      </Link>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-xs text-ink-muted inline-flex items-center gap-1">
          <Users2 className="h-3 w-3" />
          {theme.patientCount}
        </span>
        <span className="text-xs font-medium text-primary tabular-nums">
          {theme.occurrenceCount}
        </span>
      </div>
    </li>
  );
}

function FinanceRow({
  label,
  value,
  tone = "muted",
}: {
  label: string;
  value: string;
  tone?: "secondary" | "warning" | "muted";
}) {
  const valueCls =
    tone === "secondary"
      ? "text-secondary-600"
      : tone === "warning"
        ? "text-amber-700"
        : "text-ink";
  return (
    <div className="flex items-center justify-between">
      <dt className="text-ink-muted">{label}</dt>
      <dd className={`font-display text-lg tabular-nums ${valueCls}`}>
        {value}
      </dd>
    </div>
  );
}

function EmptyLine({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-ink-muted">{children}</p>;
}

type FinanceSummary = {
  expectedCents: number;
  paidCents: number;
  openCents: number;
  overdueCents: number;
  overdueCount: number;
};

function summarizeCharges(charges: Charge[]): FinanceSummary {
  const summary: FinanceSummary = {
    expectedCents: 0,
    paidCents: 0,
    openCents: 0,
    overdueCents: 0,
    overdueCount: 0,
  };
  for (const c of charges) {
    if (c.status === "canceled") continue;
    summary.expectedCents += c.amountCents;
    if (c.status === "paid") {
      summary.paidCents += c.amountCents;
    } else if (c.status === "overdue") {
      summary.openCents += c.amountCents;
      summary.overdueCents += c.amountCents;
      summary.overdueCount += 1;
    } else if (c.status === "pending") {
      summary.openCents += c.amountCents;
    }
  }
  return summary;
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

type AttentionEntry = { patient: Patient; lastNoteAt: string | null };

function collectPatientsNeedingAttention(
  activePatients: Patient[],
  lastNoteByPatient: Map<string, string>,
  today: Date,
): AttentionEntry[] {
  return activePatients
    .map<AttentionEntry>((p) => ({
      patient: p,
      lastNoteAt: lastNoteByPatient.get(p.id) ?? null,
    }))
    .filter(({ lastNoteAt }) => {
      if (!lastNoteAt) return true;
      return daysBetween(new Date(lastNoteAt), today) > ATTENTION_DAYS_THRESHOLD;
    })
    .sort((a, b) => {
      if (!a.lastNoteAt && !b.lastNoteAt) return 0;
      if (!a.lastNoteAt) return -1;
      if (!b.lastNoteAt) return 1;
      return (
        new Date(a.lastNoteAt).getTime() - new Date(b.lastNoteAt).getTime()
      );
    });
}

function currentMonthRange(): { label: string; from: string; to: string } {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const label = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(first);
  return { label, from: toDateString(first), to: toDateString(last) };
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

function formatTodayLabel(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(date);
}

function formatRelativeWhen(iso?: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  const today = startOfDay(new Date());
  const day = startOfDay(date);
  const diffDays = daysBetween(today, day);
  const time = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
  if (diffDays === 0) return `hoje às ${time}`;
  if (diffDays === 1) return `amanhã às ${time}`;
  const weekday = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
  }).format(date);
  return `${weekday} às ${time}`;
}

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function formatShortDate(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
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
