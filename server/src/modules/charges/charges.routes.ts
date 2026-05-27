import { Router } from "express";
import { z } from "zod";
import { pool } from "../../db/pool";
import { HttpError } from "../../middleware/error";

export const chargesRouter = Router();

const STORED_STATUSES = ["pending", "paid", "canceled"] as const;
const FILTER_STATUSES = [...STORED_STATUSES, "overdue"] as const;

const listQuerySchema = z.object({
  psychologistId: z.string().uuid(),
  patientId: z.string().uuid().optional(),
  status: z.enum(FILTER_STATUSES).optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

const createSchema = z.object({
  psychologistId: z.string().uuid(),
  patientId: z.string().uuid(),
  sessionId: z.string().uuid().optional(),
  description: z.string().max(255).optional(),
  amountCents: z.number().int().positive(),
  currency: z.string().length(3).optional(),
  dueDate: z.string().date(),
  notes: z.string().optional(),
});

const patchSchema = z
  .object({
    psychologistId: z.string().uuid(),
    status: z.enum(STORED_STATUSES).optional(),
    amountCents: z.number().int().positive().optional(),
    dueDate: z.string().date().optional(),
    description: z.string().max(255).optional(),
    notes: z.string().optional(),
  })
  .refine(
    (data) =>
      data.status !== undefined ||
      data.amountCents !== undefined ||
      data.dueDate !== undefined ||
      data.description !== undefined ||
      data.notes !== undefined,
    { message: "Provide at least one field to update" },
  );

type Row = {
  id: string;
  description: string | null;
  amountCents: number;
  currency: string;
  status: "pending" | "paid" | "canceled";
  dueDate: string;
  paidAt: string | null;
  createdAt: string;
  sessionId: string | null;
  patientId: string;
  patientName: string;
};

function deriveStatus(row: Row): "pending" | "paid" | "canceled" | "overdue" {
  if (row.status !== "pending") return row.status;
  const due = new Date(row.dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due.getTime() < today.getTime() ? "overdue" : "pending";
}

chargesRouter.get("/", async (req, res, next) => {
  try {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new HttpError(400, "psychologistId is required");
    }

    const { psychologistId, patientId, status, from, to, limit } = parsed.data;

    const filters: string[] = ["c.psychologist_id = $1"];
    const params: unknown[] = [psychologistId];

    if (patientId) {
      params.push(patientId);
      filters.push(`c.patient_id = $${params.length}`);
    }
    if (from) {
      params.push(from);
      filters.push(`c.due_date >= $${params.length}::date`);
    }
    if (to) {
      params.push(to);
      filters.push(`c.due_date <= $${params.length}::date`);
    }
    if (status === "overdue") {
      filters.push("c.status = 'pending' AND c.due_date < CURRENT_DATE");
    } else if (status) {
      params.push(status);
      filters.push(`c.status = $${params.length}`);
    }

    params.push(limit ?? 200);
    const limitPlaceholder = `$${params.length}`;

    const { rows } = await pool.query<Row>(
      `SELECT c.id,
              c.description,
              c.amount_cents AS "amountCents",
              c.currency,
              c.status,
              c.due_date     AS "dueDate",
              c.paid_at      AS "paidAt",
              c.created_at   AS "createdAt",
              c.session_id   AS "sessionId",
              p.id           AS "patientId",
              p.full_name    AS "patientName"
       FROM charges c
       JOIN patients p ON p.id = c.patient_id
       WHERE ${filters.join(" AND ")}
       ORDER BY c.due_date DESC, c.created_at DESC
       LIMIT ${limitPlaceholder}`,
      params,
    );

    res.json({
      charges: rows.map((row) => ({
        id: row.id,
        description: row.description,
        amountCents: row.amountCents,
        currency: row.currency,
        storedStatus: row.status,
        status: deriveStatus(row),
        dueDate: row.dueDate,
        paidAt: row.paidAt,
        createdAt: row.createdAt,
        sessionId: row.sessionId,
        patient: { id: row.patientId, fullName: row.patientName },
      })),
    });
  } catch (err) {
    next(err);
  }
});

chargesRouter.post("/", async (req, res, next) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, "Invalid payload");
    }

    const {
      psychologistId,
      patientId,
      sessionId,
      description,
      amountCents,
      currency,
      dueDate,
      notes,
    } = parsed.data;

    const ownership = await pool.query(
      `SELECT 1 FROM patients
       WHERE id = $1 AND psychologist_id = $2`,
      [patientId, psychologistId],
    );
    if (ownership.rowCount === 0) {
      throw new HttpError(404, "Patient not found");
    }

    if (sessionId) {
      const sessionOwner = await pool.query(
        `SELECT 1 FROM sessions
         WHERE id = $1 AND psychologist_id = $2 AND patient_id = $3`,
        [sessionId, psychologistId, patientId],
      );
      if (sessionOwner.rowCount === 0) {
        throw new HttpError(404, "Session not found");
      }
    }

    const { rows } = await pool.query(
      `INSERT INTO charges
         (psychologist_id, patient_id, session_id,
          description, amount_cents, currency, due_date, notes)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6, 'BRL'), $7, $8)
       RETURNING id,
                 description,
                 amount_cents AS "amountCents",
                 currency,
                 status,
                 due_date     AS "dueDate",
                 paid_at      AS "paidAt",
                 created_at   AS "createdAt"`,
      [
        psychologistId,
        patientId,
        sessionId ?? null,
        description ?? null,
        amountCents,
        currency ?? null,
        dueDate,
        notes ?? null,
      ],
    );

    res.status(201).json({ charge: rows[0] });
  } catch (err) {
    next(err);
  }
});

chargesRouter.patch("/:id", async (req, res, next) => {
  try {
    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, "Invalid payload");
    }

    const { psychologistId, status, amountCents, dueDate, description, notes } =
      parsed.data;

    const { rows, rowCount } = await pool.query(
      `UPDATE charges
       SET status       = COALESCE($1, status),
           paid_at      = CASE
                            WHEN $1 = 'paid' THEN COALESCE(paid_at, NOW())
                            WHEN $1 IN ('pending', 'canceled') THEN NULL
                            ELSE paid_at
                          END,
           amount_cents = COALESCE($2, amount_cents),
           due_date     = COALESCE($3::date, due_date),
           description  = COALESCE($4, description),
           notes        = COALESCE($5, notes),
           updated_at   = NOW()
       WHERE id = $6 AND psychologist_id = $7
       RETURNING id,
                 description,
                 amount_cents AS "amountCents",
                 currency,
                 status,
                 due_date     AS "dueDate",
                 paid_at      AS "paidAt",
                 created_at   AS "createdAt"`,
      [
        status ?? null,
        amountCents ?? null,
        dueDate ?? null,
        description ?? null,
        notes ?? null,
        req.params.id,
        psychologistId,
      ],
    );

    if (rowCount === 0) {
      throw new HttpError(404, "Charge not found");
    }

    res.json({ charge: rows[0] });
  } catch (err) {
    next(err);
  }
});
