import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireSession } from "@/lib/session";
import { NewPatientForm } from "./NewPatientForm";

export const dynamic = "force-dynamic";

export default async function NovoPacientePage() {
  await requireSession();

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href="/pacientes"
        className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-primary mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </Link>

      <h1 className="font-display text-4xl text-primary mb-2">
        Novo paciente
      </h1>
      <p className="text-ink-muted mb-8">
        Cadastre um paciente para iniciar o acompanhamento clínico.
      </p>

      <NewPatientForm />
    </div>
  );
}
