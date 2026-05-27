import { Router } from "express";
import { z } from "zod";
import { pool } from "../../db/pool";
import { HttpError } from "../../middleware/error";

export const goalsRouter = Router();

const STATUSES = ["active", "completed", "paused", "canceled"] as const;
type GoalStatus = (typeof STATUSES)[number];

const listQuerySchema = z.object({
  psychologistId: z.string().uuid(),
  patientId: z.string().uuid().optional(),
});

const createSchema = z.object({
  psychologistId: z.string().uuid(),
  patientId: z.string().uuid(),
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  targetDate: z.string().date().optional(),
});

const patchSchema = z
  .object({
    psychologistId: z.string().uuid(),
    progress: z.number().int().min(0).max(100).optional(),
    status: z.enum(STATUSES).optional(),
  })
  .refine(
    (data) => data.progress !== undefined || data.status !== undefined,
    { message: "Provide progress or status" },
  );

type Row = {
  id: string;
  title: string;
  description: string | null;
  status: GoalStatus;
  progress: number;
  targetDate: string | null;
  createdAt: string;
  updatedAt: string;
  patientId: string;
  patientName: string;
};

goalsRouter.get("/", async (req, res, next) => {
  try {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new HttpError(400, "psychologistId is required");
    }

    const { psychologistId, patientId } = parsed.data;

    const { rows } = await pool.query<Row>(
      `SELECT g.id,
              g.title,
              g.description,
              g.status,
              g.progress,
              g.target_date AS "targetDate",
              g.created_at  AS "createdAt",
              g.updated_at  AS "updatedAt",
              p.id          AS "patientId",
              p.full_name   AS "patientName"
       FROM goals g
       JOIN patients p ON p.id = g.patient_id
       WHERE g.psychologist_id = $1
         AND ($2::uuid IS NULL OR g.patient_id = $2::uuid)
       ORDER BY p.full_name ASC,
                CASE g.status
                  WHEN 'active' THEN 0
                  WHEN 'paused' THEN 1
                  WHEN 'completed' THEN 2
                  WHEN 'canceled' THEN 3
                END,
                g.created_at DESC`,
      [psychologistId, patientId ?? null],
    );

    res.json({
      goals: rows.map((row) => ({
        id: row.id,
        title: row.title,
        description: row.description,
        status: row.status,
        progress: row.progress,
        targetDate: row.targetDate,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        patient: { id: row.patientId, fullName: row.patientName },
      })),
    });
  } catch (err) {
    next(err);
  }
});

goalsRouter.post("/", async (req, res, next) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, "Invalid payload");
    }

    const { psychologistId, patientId, title, description, targetDate } =
      parsed.data;

    const ownership = await pool.query(
      `SELECT 1 FROM patients
       WHERE id = $1 AND psychologist_id = $2`,
      [patientId, psychologistId],
    );

    if (ownership.rowCount === 0) {
      throw new HttpError(404, "Patient not found");
    }

    const { rows } = await pool.query(
      `INSERT INTO goals
         (patient_id, psychologist_id, title, description, target_date)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, title, description, status, progress,
                 target_date AS "targetDate",
                 created_at  AS "createdAt",
                 updated_at  AS "updatedAt"`,
      [patientId, psychologistId, title, description ?? null, targetDate ?? null],
    );

    res.status(201).json({ goal: rows[0] });
  } catch (err) {
    next(err);
  }
});

goalsRouter.patch("/:id", async (req, res, next) => {
  try {
    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, "Invalid payload");
    }

    const { psychologistId, progress, status } = parsed.data;
    const goalId = req.params.id;

    const { rows, rowCount } = await pool.query(
      `UPDATE goals
       SET progress    = COALESCE($1, progress),
           status      = COALESCE($2, status),
           updated_at  = NOW()
       WHERE id = $3 AND psychologist_id = $4
       RETURNING id, title, description, status, progress,
                 target_date AS "targetDate",
                 created_at  AS "createdAt",
                 updated_at  AS "updatedAt"`,
      [progress ?? null, status ?? null, goalId, psychologistId],
    );

    if (rowCount === 0) {
      throw new HttpError(404, "Goal not found");
    }

    res.json({ goal: rows[0] });
  } catch (err) {
    next(err);
  }
});
