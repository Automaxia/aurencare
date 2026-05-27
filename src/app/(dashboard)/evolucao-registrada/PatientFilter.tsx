"use client";

import { useRouter, useSearchParams } from "next/navigation";

export type PatientFilterOption = {
  id: string;
  fullName: string;
};

export function PatientFilter({
  patients,
}: {
  patients: PatientFilterOption[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get("paciente") ?? "";

  return (
    <div className="inline-flex items-center gap-2">
      <label htmlFor="paciente" className="text-xs text-ink-muted">
        Paciente
      </label>
      <select
        id="paciente"
        value={current}
        onChange={(event) => {
          const value = event.target.value;
          const params = new URLSearchParams(searchParams.toString());
          if (value) {
            params.set("paciente", value);
          } else {
            params.delete("paciente");
          }
          const qs = params.toString();
          router.push(`/evolucao-registrada${qs ? `?${qs}` : ""}`);
        }}
        className="rounded-lg border border-primary-100 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
      >
        <option value="">Todos os pacientes</option>
        {patients.map((p) => (
          <option key={p.id} value={p.id}>
            {p.fullName}
          </option>
        ))}
      </select>
    </div>
  );
}
