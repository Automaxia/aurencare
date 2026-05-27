import Link from "next/link";
import { Plus, Users2 } from "lucide-react";
import { listPatients, type Patient } from "@/lib/patients";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function PacientesPage() {
  const session = await requireSession();
  const patients = await listPatients(session.user.id);

  return (
    <div className="max-w-6xl mx-auto">
      <header className="flex items-end justify-between gap-6 mb-8">
        <div>
          <h1 className="font-display text-4xl text-primary">Pacientes</h1>
          <p className="text-ink-muted mt-2">
            {patients.length === 0
              ? "Nenhum paciente cadastrado ainda."
              : `${patients.length} ${
                  patients.length === 1 ? "paciente" : "pacientes"
                } em acompanhamento.`}
          </p>
        </div>
        <Link
          href="/pacientes/novo"
          className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-600 transition"
        >
          <Plus className="h-4 w-4" />
          Novo paciente
        </Link>
      </header>

      {patients.length === 0 ? (
        <EmptyState />
      ) : (
        <PatientsTable patients={patients} />
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="bg-white rounded-2xl shadow-soft border border-primary-100/60 p-12 text-center">
      <div className="w-12 h-12 mx-auto rounded-full bg-primary-50 text-primary flex items-center justify-center mb-4">
        <Users2 className="h-5 w-5" />
      </div>
      <p className="font-display text-2xl text-ink mb-2">
        Comece com seu primeiro paciente
      </p>
      <p className="text-sm text-ink-muted mb-6 max-w-sm mx-auto">
        Cadastre um paciente para iniciar o acompanhamento clínico no Auren Care.
      </p>
      <Link
        href="/pacientes/novo"
        className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-600 transition"
      >
        <Plus className="h-4 w-4" />
        Cadastrar paciente
      </Link>
    </div>
  );
}

function PatientsTable({ patients }: { patients: Patient[] }) {
  return (
    <div className="bg-white rounded-2xl shadow-soft border border-primary-100/60 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wider text-ink-muted bg-primary-50/40">
          <tr>
            <th className="px-6 py-3 font-medium">Paciente</th>
            <th className="px-6 py-3 font-medium">Contato</th>
            <th className="px-6 py-3 font-medium">Status</th>
            <th className="px-6 py-3 font-medium">Cadastrado em</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-primary-100/60">
          {patients.map((patient) => (
            <tr key={patient.id} className="hover:bg-primary-50/30 transition">
              <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <Avatar name={patient.fullName} />
                  <div>
                    <p className="font-medium text-ink">{patient.fullName}</p>
                    {patient.birthDate && (
                      <p className="text-xs text-ink-muted">
                        {formatDate(patient.birthDate)}
                      </p>
                    )}
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 text-ink-muted">
                <div>{patient.email ?? "—"}</div>
                <div className="text-xs">{patient.phone ?? ""}</div>
              </td>
              <td className="px-6 py-4">
                <StatusBadge status={patient.status} />
              </td>
              <td className="px-6 py-4 text-ink-muted">
                {formatDate(patient.createdAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <span className="h-9 w-9 rounded-full bg-secondary/15 text-secondary-600 font-medium flex items-center justify-center text-sm">
      {initials || "?"}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const isActive = status === "active";
  return (
    <span
      className={
        isActive
          ? "inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-secondary/15 text-secondary-600"
          : "inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-primary-50 text-primary-700"
      }
    >
      <span
        className={
          isActive ? "h-1.5 w-1.5 rounded-full bg-secondary" : "h-1.5 w-1.5 rounded-full bg-primary-400"
        }
      />
      {isActive ? "Ativo" : status}
    </span>
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
