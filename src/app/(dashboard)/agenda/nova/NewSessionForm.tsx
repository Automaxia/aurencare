"use client";

import { useFormState, useFormStatus } from "react-dom";
import {
  createSessionAction,
  type CreateSessionState,
} from "../actions";

const initialState: CreateSessionState = { status: "idle" };

export type PatientOption = {
  id: string;
  fullName: string;
};

export function NewSessionForm({ patients }: { patients: PatientOption[] }) {
  const [state, formAction] = useFormState(createSessionAction, initialState);

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
          className="w-full rounded-lg border border-primary-100 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        >
          <option value="" disabled>
            Selecione um paciente
          </option>
          {patients.map((patient) => (
            <option key={patient.id} value={patient.id}>
              {patient.fullName}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-1.5">
          <label
            htmlFor="scheduledAt"
            className="text-sm font-medium text-ink"
          >
            Data e hora <span className="text-primary">*</span>
          </label>
          <input
            id="scheduledAt"
            name="scheduledAt"
            type="datetime-local"
            required
            className="w-full rounded-lg border border-primary-100 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="durationMinutes"
            className="text-sm font-medium text-ink"
          >
            Duração (min)
          </label>
          <input
            id="durationMinutes"
            name="durationMinutes"
            type="number"
            min={15}
            max={240}
            step={5}
            defaultValue={50}
            className="w-full rounded-lg border border-primary-100 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="kind" className="text-sm font-medium text-ink">
          Tipo de sessão
        </label>
        <select
          id="kind"
          name="kind"
          defaultValue="regular"
          className="w-full rounded-lg border border-primary-100 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        >
          <option value="regular">Sessão regular</option>
          <option value="first">Primeira sessão</option>
          <option value="return">Retorno</option>
        </select>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="notes" className="text-sm font-medium text-ink">
          Observações
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          className="w-full rounded-lg border border-primary-100 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        />
      </div>

      {state.status === "error" && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3 pt-2">
        <Submit />
        <a href="/agenda" className="text-sm text-ink-muted hover:text-primary">
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
      {pending ? "Agendando..." : "Agendar sessão"}
    </button>
  );
}
