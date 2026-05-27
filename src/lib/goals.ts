import "server-only";

import { apiFetch } from "./api";

export type GoalStatus = "active" | "completed" | "paused" | "canceled";

export type Goal = {
  id: string;
  title: string;
  description: string | null;
  status: GoalStatus;
  progress: number;
  targetDate: string | null;
  createdAt: string;
  updatedAt: string;
  patient: {
    id: string;
    fullName: string;
  };
};

export type CreateGoalInput = {
  psychologistId: string;
  patientId: string;
  title: string;
  description?: string;
  targetDate?: string;
};

export type UpdateGoalInput = {
  psychologistId: string;
  progress?: number;
  status?: GoalStatus;
};

export async function listGoals(
  psychologistId: string,
  patientId?: string,
): Promise<Goal[]> {
  const query = new URLSearchParams({ psychologistId });
  if (patientId) query.set("patientId", patientId);

  const response = await apiFetch(`/goals?${query.toString()}`);
  if (!response.ok) {
    throw new Error(`Falha ao carregar objetivos (${response.status})`);
  }

  const data = (await response.json()) as { goals: Goal[] };
  return data.goals;
}

export async function createGoal(input: CreateGoalInput): Promise<Goal> {
  const response = await apiFetch("/goals", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Falha ao cadastrar objetivo.");
  }
  const data = (await response.json()) as { goal: Goal };
  return data.goal;
}

export async function updateGoal(
  goalId: string,
  input: UpdateGoalInput,
): Promise<Goal> {
  const response = await apiFetch(`/goals/${goalId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Falha ao atualizar objetivo.");
  }
  const data = (await response.json()) as { goal: Goal };
  return data.goal;
}
