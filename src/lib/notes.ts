import "server-only";

import { apiFetch } from "./api";
import type { ThemeRef } from "./themes";

export type NoteMood = "positive" | "neutral" | "challenging";

export type Note = {
  id: string;
  recordedAt: string;
  content: string;
  mood: NoteMood | null;
  sessionId: string | null;
  createdAt: string;
  patient: {
    id: string;
    fullName: string;
  };
  themes: ThemeRef[];
};

export type CreateNoteInput = {
  psychologistId: string;
  patientId: string;
  sessionId?: string;
  recordedAt?: string;
  content: string;
  mood?: NoteMood;
  themeIds?: string[];
};

export async function listNotes(
  psychologistId: string,
  options: { patientId?: string; themeId?: string; limit?: number } = {},
): Promise<Note[]> {
  const query = new URLSearchParams({ psychologistId });
  if (options.patientId) query.set("patientId", options.patientId);
  if (options.themeId) query.set("themeId", options.themeId);
  if (options.limit) query.set("limit", String(options.limit));

  const response = await apiFetch(`/notes?${query.toString()}`);
  if (!response.ok) {
    throw new Error(`Falha ao carregar entradas (${response.status})`);
  }

  const data = (await response.json()) as { notes: Note[] };
  return data.notes;
}

export async function createNote(input: CreateNoteInput): Promise<Note> {
  const response = await apiFetch("/notes", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Falha ao registrar entrada.");
  }
  const data = (await response.json()) as { note: Note };
  return data.note;
}
