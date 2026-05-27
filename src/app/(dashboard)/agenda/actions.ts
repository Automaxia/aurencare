"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSession, type SessionKind } from "@/lib/sessions";
import { requireSession } from "@/lib/session";

export type CreateSessionState =
  | { status: "idle" }
  | { status: "error"; error: string };

const VALID_KINDS: ReadonlySet<SessionKind> = new Set([
  "regular",
  "first",
  "return",
]);

function asString(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function createSessionAction(
  _previous: CreateSessionState,
  formData: FormData,
): Promise<CreateSessionState> {
  const session = await requireSession();

  const patientId = asString(formData.get("patientId"));
  const scheduledAtRaw = asString(formData.get("scheduledAt"));
  const durationMinutesRaw = asString(formData.get("durationMinutes"));
  const kindRaw = asString(formData.get("kind"));
  const notes = asString(formData.get("notes"));

  if (!patientId) {
    return { status: "error", error: "Selecione um paciente." };
  }
  if (!scheduledAtRaw) {
    return { status: "error", error: "Informe data e hora da sessão." };
  }

  // datetime-local não traz timezone — interpretamos no timezone do servidor.
  const scheduledDate = new Date(scheduledAtRaw);
  if (Number.isNaN(scheduledDate.getTime())) {
    return { status: "error", error: "Data e hora inválidas." };
  }

  let durationMinutes: number | undefined;
  if (durationMinutesRaw) {
    const n = Number(durationMinutesRaw);
    if (!Number.isInteger(n) || n <= 0 || n > 480) {
      return { status: "error", error: "Duração inválida." };
    }
    durationMinutes = n;
  }

  const kind = VALID_KINDS.has(kindRaw as SessionKind)
    ? (kindRaw as SessionKind)
    : undefined;

  try {
    await createSession({
      psychologistId: session.user.id,
      patientId,
      scheduledAt: scheduledDate.toISOString(),
      durationMinutes,
      kind,
      notes: notes || undefined,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha ao agendar sessão.";
    return { status: "error", error: message };
  }

  revalidatePath("/agenda");
  redirect("/agenda");
}
