"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createGoal,
  listGoals,
  updateGoal,
  type GoalStatus,
} from "@/lib/goals";
import { requireSession } from "@/lib/session";

export type CreateGoalState =
  | { status: "idle" }
  | { status: "error"; error: string };

function asString(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function createGoalAction(
  _previous: CreateGoalState,
  formData: FormData,
): Promise<CreateGoalState> {
  const session = await requireSession();

  const patientId = asString(formData.get("patientId"));
  const title = asString(formData.get("title"));
  const description = asString(formData.get("description"));
  const targetDate = asString(formData.get("targetDate"));

  if (!patientId) {
    return { status: "error", error: "Selecione um paciente." };
  }
  if (!title) {
    return { status: "error", error: "Informe o título do objetivo." };
  }

  try {
    await createGoal({
      psychologistId: session.user.id,
      patientId,
      title,
      description: description || undefined,
      targetDate: targetDate || undefined,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha ao cadastrar objetivo.";
    return { status: "error", error: message };
  }

  revalidatePath("/objetivos-progresso");
  redirect("/objetivos-progresso");
}

export async function adjustGoalProgress(
  goalId: string,
  delta: number,
  _formData: FormData,
): Promise<void> {
  const session = await requireSession();
  const goals = await listGoals(session.user.id);
  const target = goals.find((g) => g.id === goalId);
  if (!target) return;

  const nextProgress = Math.max(0, Math.min(100, target.progress + delta));
  const nextStatus: GoalStatus | undefined =
    nextProgress === 100 && target.status === "active"
      ? "completed"
      : undefined;

  await updateGoal(goalId, {
    psychologistId: session.user.id,
    progress: nextProgress,
    status: nextStatus,
  });

  revalidatePath("/objetivos-progresso");
}

export async function completeGoal(
  goalId: string,
  _formData: FormData,
): Promise<void> {
  const session = await requireSession();
  await updateGoal(goalId, {
    psychologistId: session.user.id,
    progress: 100,
    status: "completed",
  });
  revalidatePath("/objetivos-progresso");
}

export async function reopenGoal(
  goalId: string,
  _formData: FormData,
): Promise<void> {
  const session = await requireSession();
  await updateGoal(goalId, {
    psychologistId: session.user.id,
    status: "active",
  });
  revalidatePath("/objetivos-progresso");
}
