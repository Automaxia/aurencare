"use server";

import { revalidatePath } from "next/cache";
import { createTheme, deleteTheme } from "@/lib/themes";
import { requireSession } from "@/lib/session";

export type CreateThemeState =
  | { status: "idle" }
  | { status: "error"; error: string }
  | { status: "success" };

function asString(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function createThemeAction(
  _previous: CreateThemeState,
  formData: FormData,
): Promise<CreateThemeState> {
  const session = await requireSession();

  const name = asString(formData.get("name"));
  const description = asString(formData.get("description"));

  if (!name) {
    return { status: "error", error: "Informe um nome para o tema." };
  }

  try {
    await createTheme({
      psychologistId: session.user.id,
      name,
      description: description || undefined,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha ao cadastrar tema.";
    return { status: "error", error: message };
  }

  revalidatePath("/temas-recorrentes");
  return { status: "success" };
}

export async function deleteThemeAction(
  themeId: string,
  _formData: FormData,
): Promise<void> {
  const session = await requireSession();
  await deleteTheme(themeId, session.user.id);
  revalidatePath("/temas-recorrentes");
  revalidatePath("/evolucao-registrada");
}
