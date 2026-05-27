import "server-only";

import { apiFetch } from "./api";

export type ChargeStoredStatus = "pending" | "paid" | "canceled";
export type ChargeStatus = ChargeStoredStatus | "overdue";

export type Charge = {
  id: string;
  description: string | null;
  amountCents: number;
  currency: string;
  status: ChargeStatus;
  storedStatus: ChargeStoredStatus;
  dueDate: string;
  paidAt: string | null;
  createdAt: string;
  sessionId: string | null;
  patient: {
    id: string;
    fullName: string;
  };
};

export type ListChargesOptions = {
  patientId?: string;
  status?: ChargeStatus;
  from?: string;
  to?: string;
  limit?: number;
};

export type CreateChargeInput = {
  psychologistId: string;
  patientId: string;
  sessionId?: string;
  description?: string;
  amountCents: number;
  currency?: string;
  dueDate: string;
  notes?: string;
};

export type UpdateChargeInput = {
  psychologistId: string;
  status?: ChargeStoredStatus;
  amountCents?: number;
  dueDate?: string;
  description?: string;
  notes?: string;
};

export async function listCharges(
  psychologistId: string,
  options: ListChargesOptions = {},
): Promise<Charge[]> {
  const query = new URLSearchParams({ psychologistId });
  if (options.patientId) query.set("patientId", options.patientId);
  if (options.status) query.set("status", options.status);
  if (options.from) query.set("from", options.from);
  if (options.to) query.set("to", options.to);
  if (options.limit) query.set("limit", String(options.limit));

  const response = await apiFetch(`/charges?${query.toString()}`);
  if (!response.ok) {
    throw new Error(`Falha ao carregar cobranças (${response.status})`);
  }
  const data = (await response.json()) as { charges: Charge[] };
  return data.charges;
}

export async function createCharge(input: CreateChargeInput): Promise<Charge> {
  const response = await apiFetch("/charges", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Falha ao cadastrar cobrança.");
  }
  const data = (await response.json()) as { charge: Charge };
  return data.charge;
}

export async function updateCharge(
  chargeId: string,
  input: UpdateChargeInput,
): Promise<Charge> {
  const response = await apiFetch(`/charges/${chargeId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Falha ao atualizar cobrança.");
  }
  const data = (await response.json()) as { charge: Charge };
  return data.charge;
}

export function formatCurrencyCents(cents: number, currency = "BRL"): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
  }).format(cents / 100);
}
