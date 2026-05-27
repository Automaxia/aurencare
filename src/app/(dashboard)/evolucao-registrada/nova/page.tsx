import Link from "next/link";
import { ArrowLeft, UserPlus } from "lucide-react";
import { listPatients } from "@/lib/patients";
import { requireSession } from "@/lib/session";
import { listThemes } from "@/lib/themes";
import { NewNoteForm } from "./NewNoteForm";

export const dynamic = "force-dynamic";

type SearchParams = { paciente?: string };

export default async function NovaEntradaPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireSession();
  const [patients, themes] = await Promise.all([
    listPatients(session.user.id),
    listThemes(session.user.id),
  ]);

  const defaultPatientId =
    searchParams.paciente && patients.some((p) => p.id === searchParams.paciente)
      ? searchParams.paciente
      : undefined;

  return (
    <div className="max-w-3xl mx-auto">
      <Link
        href="/evolucao-registrada"
        className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-primary mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </Link>

      <h1 className="font-display text-4xl text-primary mb-2">Nova entrada</h1>
      <p className="text-ink-muted mb-8">
        Registre observações, avanços e desafios do processo terapêutico.
      </p>

      {patients.length === 0 ? (
        <NoPatientsState />
      ) : (
        <NewNoteForm
          patients={patients.map((p) => ({
            id: p.id,
            fullName: p.fullName,
          }))}
          themes={themes.map((t) => ({ id: t.id, name: t.name }))}
          defaultPatientId={defaultPatientId}
        />
      )}
    </div>
  );
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
        As entradas de evolução são sempre vinculadas a um paciente em
        acompanhamento.
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
