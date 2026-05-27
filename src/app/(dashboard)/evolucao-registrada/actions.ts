"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createNote, type NoteMood } from "@/lib/notes";
import { requireSession } from "@/lib/session";

export type CreateNoteState =
  | { status: "idle" }
  | { status: "error"; error: string };

const VALID_MOODS: ReadonlySet<NoteMood> = new Set([
  "positive",
  "neutral",
  "challenging",
]);

function asString(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function createNoteAction(
  _previous: CreateNoteState,
  formData: FormData,
): Promise<CreateNoteState> {
  const session = await requireSession();

  const patientId = asString(formData.get("patientId"));
  const content = asString(formData.get("content"));
  const recordedAtRaw = asString(formData.get("recordedAt"));
  const moodRaw = asString(formData.get("mood"));
  const themeIds = formData
    .getAll("themeIds")
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);

  if (!patientId) {
    return { status: "error", error: "Selecione um paciente." };
  }
  if (!content) {
    return { status: "error", error: "Escreva o conteúdo da entrada." };
  }

  let recordedAt: string | undefined;
  if (recordedAtRaw) {
    const parsed = new Date(recordedAtRaw);
    if (Number.isNaN(parsed.getTime())) {
      return { status: "error", error: "Data e hora inválidas." };
    }
    recordedAt = parsed.toISOString();
  }

  const mood = VALID_MOODS.has(moodRaw as NoteMood)
    ? (moodRaw as NoteMood)
    : undefined;

  try {
    await createNote({
      psychologistId: session.user.id,
      patientId,
      recordedAt,
      content,
      mood,
      themeIds: themeIds.length > 0 ? themeIds : undefined,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha ao registrar entrada.";
    return { status: "error", error: message };
  }

  revalidatePath("/evolucao-registrada");
  redirect(`/evolucao-registrada?paciente=${patientId}`);
}
