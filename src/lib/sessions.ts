import "server-only";

import { apiFetch } from "./api";

export type SessionKind = "regular" | "first" | "return";
export type SessionStatus =
  | "scheduled"
  | "completed"
  | "canceled"
  | "no_show";

export type AgendaSession = {
  id: string;
  scheduledAt: string;
  durationMinutes: number;
  kind: SessionKind | string;
  status: SessionStatus | string;
  notes: string | null;
  patient: {
    id: string;
    fullName: string;
  };
};

export type CreateSessionInput = {
  psychologistId: string;
  patientId: string;
  scheduledAt: string;
  durationMinutes?: number;
  kind?: SessionKind;
  notes?: string;
};

export async function listUpcomingSessions(
  psychologistId: string,
): Promise<AgendaSession[]> {
  const query = new URLSearchParams({ psychologistId });
  const response = await apiFetch(`/sessions?${query.toString()}`);

  if (!response.ok) {
    throw new Error(`Falha ao carregar a agenda (${response.status})`);
  }

  const data = (await response.json()) as { sessions: AgendaSession[] };
  return data.sessions;
}

export async function createSession(
  input: CreateSessionInput,
): Promise<AgendaSession> {
  const response = await apiFetch("/sessions", {
    method: "POST",
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Falha ao agendar sessão.");
  }

  const data = (await response.json()) as { session: AgendaSession };
  return data.session;
}
