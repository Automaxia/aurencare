"use client";

import { useFormState, useFormStatus } from "react-dom";
import { createGoalAction, type CreateGoalState } from "../actions";

const initialState: CreateGoalState = { status: "idle" };

export type PatientOption = {
  id: string;
  fullName: string;
};

export function NewGoalForm({ patients }: { patients: PatientOption[] }) {
  const [state, formAction] = useFormState(createGoalAction, initialState);

  const inputClass =
    "w-full rounded-lg border border-primary-100 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary";

  return (
    <form
      action={formAction}
      className="bg-white rounded-2xl shadow-soft border border-primary-100/60 p-7 space-y-5"
    >
      <div className="space-y-1.5">
        <label htmlFor="patientId" className="text-sm font-medium text-ink">
          Paciente <span className="text-primary">*</span>
        </label>
        <select
          id="patientId"
          name="patientId"
          required
          defaultValue=""
          className={inputClass}
        >
          <option value="" disabled>
            Selecione um paciente
          </option>
          {patients.map((p) => (
            <option key={p.id} value={p.id}>
              {p.fullName}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="title" className="text-sm font-medium text-ink">
          Título do objetivo <span className="text-primary">*</span>
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          maxLength={255}
          autoFocus
          placeholder="Ex.: Reduzir crises de ansiedade noturna"
          className={inputClass}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="description" className="text-sm font-medium text-ink">
          Descrição
        </label>
        <textarea
          id="description"
          name="description"
          rows={4}
          placeholder="Contexto, indicadores ou critérios de sucesso."
          className={inputClass}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="targetDate" className="text-sm font-medium text-ink">
          Data-meta
        </label>
        <input
          id="targetDate"
          name="targetDate"
          type="date"
          className={inputClass}
        />
      </div>

      {state.status === "error" && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3 pt-2">
        <Submit />
        <a
          href="/objetivos-progresso"
          className="text-sm text-ink-muted hover:text-primary"
        >
          Cancelar
        </a>
      </div>
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-primary text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-primary-600 transition disabled:opacity-60"
    >
      {pending ? "Cadastrando..." : "Cadastrar objetivo"}
    </button>
  );
}
