import Link from "next/link";
import { CheckCircle2, Plus, RotateCcw, Target } from "lucide-react";
import { listGoals, type Goal } from "@/lib/goals";
import { requireSession } from "@/lib/session";
import { adjustGoalProgress, completeGoal, reopenGoal } from "./actions";

export const dynamic = "force-dynamic";

export default async function ObjetivosProgressoPage() {
  const session = await requireSession();
  const goals = await listGoals(session.user.id);
  const groups = groupByPatient(goals);

  const activeCount = goals.filter((g) => g.status === "active").length;

  return (
    <div className="max-w-5xl mx-auto">
      <header className="flex items-end justify-between gap-6 mb-8">
        <div>
          <h1 className="font-display text-4xl text-primary">
            Objetivos e Progresso
          </h1>
          <p className="text-ink-muted mt-2">
            {goals.length === 0
              ? "Nenhum objetivo registrado ainda."
              : `${activeCount} ativo${
                  activeCount === 1 ? "" : "s"
                } · ${goals.length} no total.`}
          </p>
        </div>
        <Link
          href="/objetivos-progresso/novo"
          className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-600 transition"
        >
          <Plus className="h-4 w-4" />
          Novo objetivo
        </Link>
      </header>

      {groups.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <PatientGroup key={group.patientId} group={group} />
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
        <Target className="h-5 w-5" />
      </div>
      <p className="font-display text-2xl text-ink mb-2">
        Comece definindo um objetivo
      </p>
      <p className="text-sm text-ink-muted mb-6 max-w-sm mx-auto">
        Registre objetivos clínicos com seus pacientes e acompanhe a evolução
        ao longo do processo terapêutico.
      </p>
      <Link
        href="/objetivos-progresso/novo"
        className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-600 transition"
      >
        <Plus className="h-4 w-4" />
        Cadastrar objetivo
      </Link>
    </div>
  );
}

type GoalGroup = {
  patientId: string;
  patientName: string;
  goals: Goal[];
};

function groupByPatient(goals: Goal[]): GoalGroup[] {
  const map = new Map<string, GoalGroup>();
  for (const goal of goals) {
    const existing = map.get(goal.patient.id);
    if (existing) {
      existing.goals.push(goal);
    } else {
      map.set(goal.patient.id, {
        patientId: goal.patient.id,
        patientName: goal.patient.fullName,
        goals: [goal],
      });
    }
  }
  return Array.from(map.values());
}

function PatientGroup({ group }: { group: GoalGroup }) {
  return (
    <section className="bg-white rounded-2xl shadow-soft border border-primary-100/60 overflow-hidden">
      <header className="px-6 py-3 bg-primary-50/40 border-b border-primary-100/60">
        <p className="font-display text-lg text-ink">{group.patientName}</p>
        <p className="text-xs text-ink-muted">
          {group.goals.length}{" "}
          {group.goals.length === 1 ? "objetivo" : "objetivos"}
        </p>
      </header>
      <div className="divide-y divide-primary-100/60">
        {group.goals.map((goal) => (
          <GoalRow key={goal.id} goal={goal} />
        ))}
      </div>
    </section>
  );
}

function GoalRow({ goal }: { goal: Goal }) {
  const isActive = goal.status === "active";
  const isCompleted = goal.status === "completed";

  return (
    <div className="px-6 py-5">
      <div className="flex items-start justify-between gap-4 mb-2">
        <div className="min-w-0">
          <p className="font-medium text-ink">{goal.title}</p>
          {goal.description && (
            <p className="text-sm text-ink-muted mt-1 line-clamp-2">
              {goal.description}
            </p>
          )}
          {goal.targetDate && (
            <p className="text-xs text-ink-muted mt-1">
              Meta para {formatDate(goal.targetDate)}
            </p>
          )}
        </div>
        <StatusBadge status={goal.status} />
      </div>

      <div className="flex items-center gap-4 mt-3">
        <ProgressBar value={goal.progress} />
        <span className="font-display text-lg text-primary w-12 text-right tabular-nums">
          {goal.progress}%
        </span>
      </div>

      {(isActive || isCompleted) && (
        <div className="flex items-center gap-2 mt-3">
          {isActive && (
            <>
              <ActionButton
                action={adjustGoalProgress.bind(null, goal.id, 10)}
                label="+10%"
              />
              <ActionButton
                action={adjustGoalProgress.bind(null, goal.id, -10)}
                label="-10%"
                variant="ghost"
              />
              <ActionButton
                action={completeGoal.bind(null, goal.id)}
                label="Concluir"
                icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                variant="secondary"
              />
            </>
          )}
          {isCompleted && (
            <ActionButton
              action={reopenGoal.bind(null, goal.id)}
              label="Reabrir"
              icon={<RotateCcw className="h-3.5 w-3.5" />}
              variant="ghost"
            />
          )}
        </div>
      )}
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="flex-1 h-2 rounded-full bg-primary-50 overflow-hidden">
      <div
        className="h-full bg-primary rounded-full transition-all"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: Goal["status"] }) {
  const map = {
    active: { label: "Ativo", cls: "bg-secondary/15 text-secondary-600" },
    completed: { label: "Concluído", cls: "bg-primary-50 text-primary-700" },
    paused: { label: "Pausado", cls: "bg-primary-50 text-ink-muted" },
    canceled: { label: "Cancelado", cls: "bg-primary-50 text-ink-muted" },
  } as const;
  const info = map[status];
  return (
    <span
      className={`inline-flex items-center text-xs px-2.5 py-1 rounded-full shrink-0 ${info.cls}`}
    >
      {info.label}
    </span>
  );
}

function ActionButton({
  action,
  label,
  icon,
  variant = "primary",
}: {
  action: (formData: FormData) => Promise<void>;
  label: string;
  icon?: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost";
}) {
  const cls =
    variant === "secondary"
      ? "bg-secondary/10 text-secondary-600 hover:bg-secondary/20"
      : variant === "ghost"
        ? "text-ink-muted hover:bg-primary-50"
        : "bg-primary-50 text-primary-700 hover:bg-primary-100";

  return (
    <form action={action}>
      <button
        type="submit"
        className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md transition ${cls}`}
      >
        {icon}
        {label}
      </button>
    </form>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}
