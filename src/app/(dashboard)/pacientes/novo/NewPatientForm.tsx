"use client";

import { useFormState, useFormStatus } from "react-dom";
import {
  createPatientAction,
  type CreatePatientState,
} from "../actions";

const initialState: CreatePatientState = { status: "idle" };

export function NewPatientForm() {
  const [state, formAction] = useFormState(createPatientAction, initialState);

  return (
    <form
      action={formAction}
      className="bg-white rounded-2xl shadow-soft border border-primary-100/60 p-7 space-y-5"
    >
      <Field name="fullName" label="Nome completo" required autoFocus />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Field name="email" label="E-mail" type="email" />
        <Field name="phone" label="Telefone" />
      </div>

      <Field name="birthDate" label="Data de nascimento" type="date" />

      <Field name="notes" label="Observações" multiline rows={4} />

      {state.status === "error" && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3 pt-2">
        <Submit />
        <a
          href="/pacientes"
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
      {pending ? "Cadastrando..." : "Cadastrar paciente"}
    </button>
  );
}

type FieldProps = {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  autoFocus?: boolean;
  multiline?: boolean;
  rows?: number;
};

function Field({
  name,
  label,
  type = "text",
  required,
  autoFocus,
  multiline,
  rows,
}: FieldProps) {
  const baseClass =
    "w-full rounded-lg border border-primary-100 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary";

  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="text-sm font-medium text-ink">
        {label}
        {required && <span className="text-primary"> *</span>}
      </label>
      {multiline ? (
        <textarea
          id={name}
          name={name}
          rows={rows ?? 3}
          required={required}
          autoFocus={autoFocus}
          className={baseClass}
        />
      ) : (
        <input
          id={name}
          name={name}
          type={type}
          required={required}
          autoFocus={autoFocus}
          className={baseClass}
        />
      )}
    </div>
  );
}
