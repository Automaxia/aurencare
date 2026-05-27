"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createCharge, updateCharge } from "@/lib/charges";
import { requireSession } from "@/lib/session";

export type CreateChargeState =
  | { status: "idle" }
  | { status: "error"; error: string };

function asString(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseAmountToCents(raw: string): number | null {
  if (!raw) return null;
  const normalized = raw.replace(/\s/g, "").replace(",", ".");
  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100);
}

export async function createChargeAction(
  _previous: CreateChargeState,
  formData: FormData,
): Promise<CreateChargeState> {
  const session = await requireSession();

  const patientId = asString(formData.get("patientId"));
  const description = asString(formData.get("description"));
  const amountRaw = asString(formData.get("amount"));
  const dueDate = asString(formData.get("dueDate"));

  if (!patientId) {
    return { status: "error", error: "Selecione um paciente." };
  }
  if (!dueDate) {
    return { status: "error", error: "Informe a data de vencimento." };
  }

  const amountCents = parseAmountToCents(amountRaw);
  if (amountCents === null) {
    return { status: "error", error: "Valor inválido." };
  }

  try {
    await createCharge({
      psychologistId: session.user.id,
      patientId,
      description: description || undefined,
      amountCents,
      dueDate,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha ao cadastrar cobrança.";
    return { status: "error", error: message };
  }

  const monthQuery = dueDate.slice(0, 7);
  revalidatePath("/financeiro");
  redirect(`/financeiro?mes=${monthQuery}`);
}

export async function markChargePaid(
  chargeId: string,
  _formData: FormData,
): Promise<void> {
  const session = await requireSession();
  await updateCharge(chargeId, {
    psychologistId: session.user.id,
    status: "paid",
  });
  revalidatePath("/financeiro");
}

export async function reopenCharge(
  chargeId: string,
  _formData: FormData,
): Promise<void> {
  const session = await requireSession();
  await updateCharge(chargeId, {
    psychologistId: session.user.id,
    status: "pending",
  });
  revalidatePath("/financeiro");
}

export async function cancelCharge(
  chargeId: string,
  _formData: FormData,
): Promise<void> {
  const session = await requireSession();
  await updateCharge(chargeId, {
    psychologistId: session.user.id,
    status: "canceled",
  });
  revalidatePath("/financeiro");
}
