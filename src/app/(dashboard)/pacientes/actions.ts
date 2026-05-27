"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createPatient } from "@/lib/patients";
import { requireSession } from "@/lib/session";

export type CreatePatientState =
  | { status: "idle" }
  | { status: "error"; error: string };

function stringOrUndefined(value: FormDataEntryValue | null): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

export async function createPatientAction(
  _previous: CreatePatientState,
  formData: FormData,
): Promise<CreatePatientState> {
  const session = await requireSession();

  const fullName = stringOrUndefined(formData.get("fullName"));
  if (!fullName) {
    return { status: "error", error: "Informe o nome do paciente." };
  }

  try {
    await createPatient({
      psychologistId: session.user.id,
      fullName,
      email: stringOrUndefined(formData.get("email")),
      phone: stringOrUndefined(formData.get("phone")),
      birthDate: stringOrUndefined(formData.get("birthDate")),
      notes: stringOrUndefined(formData.get("notes")),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha ao cadastrar paciente.";
    return { status: "error", error: message };
  }

  revalidatePath("/pacientes");
  redirect("/pacientes");
}
