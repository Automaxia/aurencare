"use client";

import { useEffect, useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Plus } from "lucide-react";
import { createThemeAction, type CreateThemeState } from "./actions";

const initialState: CreateThemeState = { status: "idle" };

export function NewThemeForm() {
  const [state, formAction] = useFormState(createThemeAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
    }
  }, [state]);

  const inputClass =
    "w-full rounded-lg border border-primary-100 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary";

  return (
    <form
      ref={formRef}
      action={formAction}
      className="bg-white rounded-2xl shadow-soft border border-primary-100/60 p-5"
    >
      <div className="grid grid-cols-1 md:grid-cols-[1fr_1.5fr_auto] gap-3 items-end">
        <div className="space-y-1.5">
          <label htmlFor="name" className="text-xs font-medium text-ink">
            Nome do tema
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            maxLength={100}
            placeholder="Ex.: Ansiedade social"
            className={inputClass}
          />
        </div>
        <div className="space-y-1.5">
          <label
            htmlFor="description"
            className="text-xs font-medium text-ink"
          >
            Descrição (opcional)
          </label>
          <input
            id="description"
            name="description"
            type="text"
            placeholder="Contexto ou critério clínico"
            className={inputClass}
          />
        </div>
        <Submit />
      </div>

      {state.status === "error" && (
        <p className="text-sm text-red-600 mt-3" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center gap-2 bg-primary text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-primary-600 transition disabled:opacity-60"
    >
      <Plus className="h-4 w-4" />
      {pending ? "Salvando..." : "Adicionar"}
    </button>
  );
}
