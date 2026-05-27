import "server-only";

import { apiFetch } from "./api";

export type ThemeRef = {
  id: string;
  name: string;
};

export type Theme = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  occurrenceCount: number;
  patientCount: number;
  lastRecordedAt: string | null;
};

export type CreateThemeInput = {
  psychologistId: string;
  name: string;
  description?: string;
};

export async function listThemes(psychologistId: string): Promise<Theme[]> {
  const query = new URLSearchParams({ psychologistId });
  const response = await apiFetch(`/themes?${query.toString()}`);
  if (!response.ok) {
    throw new Error(`Falha ao carregar temas (${response.status})`);
  }
  const data = (await response.json()) as { themes: Theme[] };
  return data.themes;
}

export async function createTheme(input: CreateThemeInput): Promise<Theme> {
  const response = await apiFetch("/themes", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    if (response.status === 409) {
      throw new Error("Já existe um tema com esse nome.");
    }
    const message = await response.text();
    throw new Error(message || "Falha ao cadastrar tema.");
  }
  const data = (await response.json()) as { theme: Theme };
  return data.theme;
}

export async function deleteTheme(
  themeId: string,
  psychologistId: string,
): Promise<void> {
  const query = new URLSearchParams({ psychologistId });
  const response = await apiFetch(
    `/themes/${themeId}?${query.toString()}`,
    { method: "DELETE" },
  );
  if (!response.ok && response.status !== 204) {
    const message = await response.text();
    throw new Error(message || "Falha ao remover tema.");
  }
}
