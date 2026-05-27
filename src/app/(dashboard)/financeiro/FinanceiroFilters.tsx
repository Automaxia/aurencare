"use client";

import { useRouter, useSearchParams } from "next/navigation";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Todas" },
  { value: "pending", label: "Pendentes" },
  { value: "overdue", label: "Atrasadas" },
  { value: "paid", label: "Pagas" },
  { value: "canceled", label: "Canceladas" },
];

export function FinanceiroFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const month = searchParams.get("mes") ?? "";
  const status = searchParams.get("status") ?? "";

  function update(key: "mes" | "status", value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    const qs = params.toString();
    router.push(`/financeiro${qs ? `?${qs}` : ""}`);
  }

  const inputClass =
    "rounded-lg border border-primary-100 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary";

  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="mes" className="text-xs text-ink-muted">
          Mês
        </label>
        <input
          id="mes"
          type="month"
          value={month}
          onChange={(event) => update("mes", event.target.value)}
          className={inputClass}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="status" className="text-xs text-ink-muted">
          Status
        </label>
        <select
          id="status"
          value={status}
          onChange={(event) => update("status", event.target.value)}
          className={inputClass}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
