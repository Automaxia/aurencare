import { Router } from "express";
import { z } from "zod";
import { pool } from "../../db/pool";
import { HttpError } from "../../middleware/error";

export const sessionsRouter = Router();

const listQuerySchema = z.object({
  psychologistId: z.string().uuid(),
  from: z.string().datetime().optional(),
});

const createSchema = z.object({
  psychologistId: z.string().uuid(),
  patientId: z.string().uuid(),
  scheduledAt: z.string().datetime(),
  durationMinutes: z.number().int().positive().max(480).optional(),
  kind: z.enum(["regular", "first", "return"]).optional(),
  notes: z.string().optional(),
});

type Row = {
  id: string;
  scheduledAt: string;
  durationMinutes: number;
  kind: string;
  status: string;
  notes: string | null;
  patientId: string;
  patientName: string;
};

sessionsRouter.get("/", async (req, res, next) => {
  try {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new HttpError(400, "psychologistId is required");
    }

    const fromIso = parsed.data.from ?? new Date().toISOString();

    const { rows } = await pool.query<Row>(
      `SELECT s.id,
              s.scheduled_at      AS "scheduledAt",
              s.duration_minutes  AS "durationMinutes",
              s.kind,
              s.status,
              s.notes,
              p.id                AS "patientId",
              p.full_name         AS "patientName"
       FROM sessions s
       JOIN patients p ON p.id = s.patient_id
       WHERE s.psychologist_id = $1
         AND s.scheduled_at >= $2
       ORDER BY s.scheduled_at ASC
       LIMIT 200`,
      [parsed.data.psychologistId, fromIso],
    );

    res.json({
      sessions: rows.map((row) => ({
        id: row.id,
        scheduledAt: row.scheduledAt,
        durationMinutes: row.durationMinutes,
        kind: row.kind,
        status: row.status,
        notes: row.notes,
        patient: { id: row.patientId, fullName: row.patientName },
      })),
    });
  } catch (err) {
    next(err);
  }
});

sessionsRouter.post("/", async (req, res, next) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, "Invalid payload");
    }

    const {
      psychologistId,
      patientId,
      scheduledAt,
      durationMinutes,
      kind,
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

    const { rows } = await pool.query(
      `INSERT INTO sessions
         (patient_id, psychologist_id, scheduled_at, duration_minutes, kind, notes)
       VALUES ($1, $2, $3, COALESCE($4, 50), COALESCE($5, 'regular'), $6)
       RETURNING id,
                 scheduled_at      AS "scheduledAt",
                 duration_minutes  AS "durationMinutes",
                 kind,
                 status,
                 notes`,
      [
        patientId,
        psychologistId,
        scheduledAt,
        durationMinutes ?? null,
        kind ?? null,
        notes ?? null,
      ],
    );

    res.status(201).json({ session: rows[0] });
  } catch (err) {
    next(err);
  }
});
