import Link from "next/link";
import { ArrowLeft, UserPlus } from "lucide-react";
import { listPatients } from "@/lib/patients";
import { requireSession } from "@/lib/session";
import { NewChargeForm } from "./NewChargeForm";

export const dynamic = "force-dynamic";

export default async function NovaCobrancaPage() {
  const session = await requireSession();
  const patients = await listPatients(session.user.id);

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href="/financeiro"
        className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-primary mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </Link>

      <h1 className="font-display text-4xl text-primary mb-2">Nova cobrança</h1>
      <p className="text-ink-muted mb-8">
        Registre uma cobrança vinculada a um paciente.
      </p>

      {patients.length === 0 ? (
        <NoPatientsState />
      ) : (
        <NewChargeForm
          patients={patients.map((p) => ({
            id: p.id,
            fullName: p.fullName,
          }))}
          defaultDueDate={todayString()}
        />
      )}
    </div>
  );
}

function todayString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function NoPatientsState() {
  return (
    <div className="bg-white rounded-2xl shadow-soft border border-primary-100/60 p-10 text-center">
      <div className="w-12 h-12 mx-auto rounded-full bg-primary-50 text-primary flex items-center justify-center mb-4">
        <UserPlus className="h-5 w-5" />
      </div>
      <p className="font-display text-2xl text-ink mb-2">
        Cadastre um paciente primeiro
      </p>
      <p className="text-sm text-ink-muted mb-6 max-w-sm mx-auto">
        Cobranças são sempre vinculadas a um paciente em acompanhamento.
      </p>
      <Link
        href="/pacientes/novo"
        className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-600 transition"
      >
        <UserPlus className="h-4 w-4" />
        Cadastrar paciente
      </Link>
    </div>
  );
}
