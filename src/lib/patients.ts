import "server-only";

import { apiFetch } from "./api";

export type Patient = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  birthDate: string | null;
  status: string;
  createdAt: string;
};

export type CreatePatientInput = {
  psychologistId: string;
  fullName: string;
  email?: string;
  phone?: string;
  birthDate?: string;
  notes?: string;
};

export async function listPatients(psychologistId: string): Promise<Patient[]> {
  const query = new URLSearchParams({ psychologistId });
  const response = await apiFetch(`/patients?${query.toString()}`);

  if (!response.ok) {
    throw new Error(`Falha ao carregar pacientes (${response.status})`);
  }

  const data = (await response.json()) as { patients: Patient[] };
  return data.patients;
}

export async function createPatient(
  input: CreatePatientInput,
): Promise<Patient> {
  const response = await apiFetch("/patients", {
    method: "POST",
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Falha ao cadastrar paciente.");
  }

  const data = (await response.json()) as { patient: Patient };
  return data.patient;
}
