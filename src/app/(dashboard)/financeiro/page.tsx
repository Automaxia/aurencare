import Link from "next/link";
import {
  CheckCircle2,
  CircleDollarSign,
  Plus,
  RotateCcw,
  XCircle,
} from "lucide-react";
import {
  formatCurrencyCents,
  listCharges,
  type Charge,
  type ChargeStatus,
} from "@/lib/charges";
import { requireSession } from "@/lib/session";
import { cancelCharge, markChargePaid, reopenCharge } from "./actions";
import { FinanceiroFilters } from "./FinanceiroFilters";

export const dynamic = "force-dynamic";

const VALID_STATUSES = new Set<ChargeStatus>([
  "pending",
  "paid",
  "canceled",
  "overdue",
]);

type SearchParams = { mes?: string; status?: string };

export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireSession();
  const month = parseMonth(searchParams.mes);
  const statusFilter = parseStatus(searchParams.status);

  const charges = await listCharges(session.user.id, {
    from: month.from,
    to: month.to,
    status: statusFilter,
  });

  const summary = summarize(charges);

  return (
    <div className="max-w-6xl mx-auto">
      <header className="flex items-end justify-between gap-6 mb-8">
        <div>
          <h1 className="font-display text-4xl text-primary">Financeiro</h1>
          <p className="text-ink-muted mt-2 capitalize">{month.label}</p>
        </div>
        <Link
          href="/financeiro/nova"
          className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-600 transition"
        >
          <Plus className="h-4 w-4" />
          Nova cobrança
        </Link>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        <StatCard
          label="Esperado no mês"
          value={formatCurrencyCents(summary.expectedCents)}
          hint={`${summary.expectedCount} ${
            summary.expectedCount === 1 ? "cobrança" : "cobranças"
          }`}
          tone="primary"
        />
        <StatCard
          label="Recebido"
          value={formatCurrencyCents(summary.paidCents)}
          hint={`${summary.paidCount} ${
            summary.paidCount === 1 ? "paga" : "pagas"
          }`}
          tone="secondary"
        />
        <StatCard
          label="Em aberto"
          value={formatCurrencyCents(summary.openCents)}
          hint={
            summary.overdueCount > 0
              ? `${summary.overdueCount} ${
                  summary.overdueCount === 1 ? "atrasada" : "atrasadas"
                }`
              : `${summary.pendingCount} pendente${
                  summary.pendingCount === 1 ? "" : "s"
                }`
          }
          tone={summary.overdueCount > 0 ? "warning" : "muted"}
        />
      </section>

      <div className="mb-6">
        <FinanceiroFilters />
      </div>

      {charges.length === 0 ? (
        <EmptyState />
      ) : (
        <ChargesTable charges={charges} />
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="bg-white rounded-2xl shadow-soft border border-primary-100/60 p-12 text-center">
      <div className="w-12 h-12 mx-auto rounded-full bg-primary-50 text-primary flex items-center justify-center mb-4">
        <CircleDollarSign className="h-5 w-5" />
      </div>
      <p className="font-display text-2xl text-ink mb-2">
        Nenhuma cobrança no recorte
      </p>
      <p className="text-sm text-ink-muted mb-6 max-w-sm mx-auto">
        Ajuste os filtros acima ou cadastre uma nova cobrança.
      </p>
      <Link
        href="/financeiro/nova"
        className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-600 transition"
      >
        <Plus className="h-4 w-4" />
        Nova cobrança
      </Link>
    </div>
  );
}

function ChargesTable({ charges }: { charges: Charge[] }) {
  return (
    <div className="bg-white rounded-2xl shadow-soft border border-primary-100/60 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wider text-ink-muted bg-primary-50/40">
          <tr>
            <th className="px-6 py-3 font-medium">Vencimento</th>
            <th className="px-6 py-3 font-medium">Paciente</th>
            <th className="px-6 py-3 font-medium">Descrição</th>
            <th className="px-6 py-3 font-medium text-right">Valor</th>
            <th className="px-6 py-3 font-medium">Status</th>
            <th className="px-6 py-3 font-medium text-right">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-primary-100/60">
          {charges.map((charge) => (
            <ChargeRow key={charge.id} charge={charge} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChargeRow({ charge }: { charge: Charge }) {
  const canMarkPaid =
    charge.status === "pending" || charge.status === "overdue";

  return (
    <tr className="hover:bg-primary-50/30 transition">
      <td className="px-6 py-4 whitespace-nowrap">
        {formatDate(charge.dueDate)}
      </td>
      <td className="px-6 py-4">{charge.patient.fullName}</td>
      <td className="px-6 py-4 text-ink-muted">
        {charge.description ?? "—"}
      </td>
      <td className="px-6 py-4 text-right font-display text-lg text-ink tabular-nums">
        {formatCurrencyCents(charge.amountCents, charge.currency)}
      </td>
      <td className="px-6 py-4">
        <StatusBadge status={charge.status} />
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center justify-end gap-2">
          {canMarkPaid && (
            <RowAction
              action={markChargePaid.bind(null, charge.id)}
              label="Marcar como pago"
              icon={<CheckCircle2 className="h-3.5 w-3.5" />}
              variant="secondary"
            />
          )}
          {charge.status === "paid" && (
            <RowAction
              action={reopenCharge.bind(null, charge.id)}
              label="Reabrir"
              icon={<RotateCcw className="h-3.5 w-3.5" />}
              variant="ghost"
            />
          )}
          {(charge.status === "pending" || charge.status === "overdue") && (
            <RowAction
              action={cancelCharge.bind(null, charge.id)}
              label="Cancelar"
              icon={<XCircle className="h-3.5 w-3.5" />}
              variant="ghost"
            />
          )}
        </div>
      </td>
    </tr>
  );
}

function StatusBadge({ status }: { status: ChargeStatus }) {
  const map = {
    pending: {
      label: "Pendente",
      cls: "bg-primary-50 text-primary-700",
    },
    paid: {
      label: "Pago",
      cls: "bg-secondary/15 text-secondary-600",
    },
    overdue: {
      label: "Atrasado",
      cls: "bg-amber-50 text-amber-700",
    },
    canceled: {
      label: "Cancelado",
      cls: "bg-primary-50 text-ink-muted",
    },
  } as const;
  const info = map[status];
  return (
    <span
      className={`inline-flex items-center text-xs px-2.5 py-1 rounded-full ${info.cls}`}
    >
      {info.label}
    </span>
  );
}

function RowAction({
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

function StatCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: "primary" | "secondary" | "warning" | "muted";
}) {
  const accent =
    tone === "secondary"
      ? "bg-secondary/15 text-secondary-600"
      : tone === "warning"
        ? "bg-amber-50 text-amber-700"
        : tone === "muted"
          ? "bg-primary-50 text-ink-muted"
          : "bg-primary-50 text-primary";

  return (
    <div className="bg-white rounded-2xl shadow-soft border border-primary-100/60 p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-ink-muted">{label}</p>
        <span className={`h-8 w-8 rounded-lg flex items-center justify-center ${accent}`}>
          <CircleDollarSign className="h-4 w-4" />
        </span>
      </div>
      <p className="font-display text-3xl text-ink leading-none tabular-nums">
        {value}
      </p>
      <p className="text-xs text-ink-muted mt-2">{hint}</p>
    </div>
  );
}

type Summary = {
  expectedCount: number;
  expectedCents: number;
  paidCount: number;
  paidCents: number;
  pendingCount: number;
  pendingCents: number;
  overdueCount: number;
  overdueCents: number;
  openCents: number;
};

function summarize(charges: Charge[]): Summary {
  const summary: Summary = {
    expectedCount: 0,
    expectedCents: 0,
    paidCount: 0,
    paidCents: 0,
    pendingCount: 0,
    pendingCents: 0,
    overdueCount: 0,
    overdueCents: 0,
    openCents: 0,
  };

  for (const charge of charges) {
    if (charge.status === "canceled") continue;
    summary.expectedCount += 1;
    summary.expectedCents += charge.amountCents;

    if (charge.status === "paid") {
      summary.paidCount += 1;
      summary.paidCents += charge.amountCents;
    } else if (charge.status === "overdue") {
      summary.overdueCount += 1;
      summary.overdueCents += charge.amountCents;
      summary.openCents += charge.amountCents;
    } else if (charge.status === "pending") {
      summary.pendingCount += 1;
      summary.pendingCents += charge.amountCents;
      summary.openCents += charge.amountCents;
    }
  }

  return summary;
}

function parseMonth(value?: string): {
  label: string;
  from: string;
  to: string;
} {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth();

  if (value && /^\d{4}-\d{2}$/.test(value)) {
    const [yearStr, monthStr] = value.split("-");
    year = Number(yearStr);
    month = Number(monthStr) - 1;
  }

  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);

  const label = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(first);

  return {
    label,
    from: toDateString(first),
    to: toDateString(last),
  };
}

function toDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseStatus(value?: string): ChargeStatus | undefined {
  if (!value) return undefined;
  return VALID_STATUSES.has(value as ChargeStatus)
    ? (value as ChargeStatus)
    : undefined;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  }).format(date);
}
