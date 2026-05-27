"use client";

import { useFormState, useFormStatus } from "react-dom";
import { createChargeAction, type CreateChargeState } from "../actions";

const initialState: CreateChargeState = { status: "idle" };

export type PatientOption = {
  id: string;
  fullName: string;
};

export function NewChargeForm({
  patients,
  defaultDueDate,
}: {
  patients: PatientOption[];
  defaultDueDate: string;
}) {
  const [state, formAction] = useFormState(createChargeAction, initialState);

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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-1.5">
          <label htmlFor="amount" className="text-sm font-medium text-ink">
            Valor (R$) <span className="text-primary">*</span>
          </label>
          <input
            id="amount"
            name="amount"
            type="text"
            inputMode="decimal"
            required
            placeholder="150,00"
            className={inputClass}
          />
          <p className="text-xs text-ink-muted">
            Use ponto ou vírgula como separador decimal.
          </p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="dueDate" className="text-sm font-medium text-ink">
            Vencimento <span className="text-primary">*</span>
          </label>
          <input
            id="dueDate"
            name="dueDate"
            type="date"
            required
            defaultValue={defaultDueDate}
            className={inputClass}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="description" className="text-sm font-medium text-ink">
          Descrição
        </label>
        <input
          id="description"
          name="description"
          type="text"
          maxLength={255}
          placeholder="Ex.: Sessão semanal · maio"
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
          href="/financeiro"
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
      {pending ? "Cadastrando..." : "Cadastrar cobrança"}
    </button>
  );
}
