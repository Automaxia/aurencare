"use client";

import { useFormState, useFormStatus } from "react-dom";
import { createNoteAction, type CreateNoteState } from "../actions";

const initialState: CreateNoteState = { status: "idle" };

export type PatientOption = {
  id: string;
  fullName: string;
};

export type ThemeOption = {
  id: string;
  name: string;
};

export function NewNoteForm({
  patients,
  themes,
  defaultPatientId,
}: {
  patients: PatientOption[];
  themes: ThemeOption[];
  defaultPatientId?: string;
}) {
  const [state, formAction] = useFormState(createNoteAction, initialState);

  const inputClass =
    "w-full rounded-lg border border-primary-100 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary";

  return (
    <form
      action={formAction}
      className="bg-white rounded-2xl shadow-soft border border-primary-100/60 p-7 space-y-5"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-1.5">
          <label htmlFor="patientId" className="text-sm font-medium text-ink">
            Paciente <span className="text-primary">*</span>
          </label>
          <select
            id="patientId"
            name="patientId"
            required
            defaultValue={defaultPatientId ?? ""}
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
          <label
            htmlFor="recordedAt"
            className="text-sm font-medium text-ink"
          >
            Data da entrada
          </label>
          <input
            id="recordedAt"
            name="recordedAt"
            type="datetime-local"
            className={inputClass}
          />
          <p className="text-xs text-ink-muted">
            Deixe em branco para usar o momento atual.
          </p>
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-ink mb-1">Tom da entrada</legend>
        <div className="flex flex-wrap gap-2">
          <MoodOption value="" label="Sem marcação" defaultChecked />
          <MoodOption value="positive" label="Avanço" />
          <MoodOption value="neutral" label="Observação" />
          <MoodOption value="challenging" label="Desafio" />
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-ink mb-1">
          Temas
        </legend>
        {themes.length === 0 ? (
          <p className="text-xs text-ink-muted">
            Cadastre temas em{" "}
            <a
              href="/temas-recorrentes"
              className="text-primary hover:underline"
            >
              Temas Recorrentes
            </a>{" "}
            para marcar esta entrada.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {themes.map((theme) => (
              <ThemeChip key={theme.id} id={theme.id} name={theme.name} />
            ))}
          </div>
        )}
      </fieldset>

      <div className="space-y-1.5">
        <label htmlFor="content" className="text-sm font-medium text-ink">
          Conteúdo <span className="text-primary">*</span>
        </label>
        <textarea
          id="content"
          name="content"
          rows={8}
          required
          maxLength={10000}
          placeholder="Descreva os pontos mais importantes desta sessão ou observação."
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
          href="/evolucao-registrada"
          className="text-sm text-ink-muted hover:text-primary"
        >
          Cancelar
        </a>
      </div>
    </form>
  );
}

function MoodOption({
  value,
  label,
  defaultChecked,
}: {
  value: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer text-sm px-3 py-1.5 rounded-full border border-primary-100 bg-white hover:bg-primary-50 has-[:checked]:bg-primary has-[:checked]:text-white has-[:checked]:border-primary transition">
      <input
        type="radio"
        name="mood"
        value={value}
        defaultChecked={defaultChecked}
        className="sr-only"
      />
      {label}
    </label>
  );
}

function ThemeChip({ id, name }: { id: string; name: string }) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer text-sm px-3 py-1.5 rounded-full border border-primary-100 bg-white hover:bg-primary-50 has-[:checked]:bg-secondary/15 has-[:checked]:text-secondary-600 has-[:checked]:border-secondary/40 transition">
      <input
        type="checkbox"
        name="themeIds"
        value={id}
        className="sr-only"
      />
      {name}
    </label>
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
      {pending ? "Registrando..." : "Registrar entrada"}
    </button>
  );
}
