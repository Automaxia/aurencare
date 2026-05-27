import { Router } from "express";
import { z } from "zod";
import { pool } from "../../db/pool";
import { HttpError } from "../../middleware/error";

export const themesRouter = Router();

const listQuerySchema = z.object({
  psychologistId: z.string().uuid(),
});

const createSchema = z.object({
  psychologistId: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
});

const deleteQuerySchema = z.object({
  psychologistId: z.string().uuid(),
});

themesRouter.get("/", async (req, res, next) => {
  try {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new HttpError(400, "psychologistId is required");
    }

    const { rows } = await pool.query(
      `SELECT t.id,
              t.name,
              t.description,
              t.created_at                       AS "createdAt",
              COUNT(DISTINCT nt.note_id)::int    AS "occurrenceCount",
              COUNT(DISTINCT n.patient_id)::int  AS "patientCount",
              MAX(n.recorded_at)                 AS "lastRecordedAt"
       FROM themes t
       LEFT JOIN note_themes nt ON nt.theme_id = t.id
       LEFT JOIN notes n        ON n.id = nt.note_id
       WHERE t.psychologist_id = $1
       GROUP BY t.id
       ORDER BY "occurrenceCount" DESC, t.name ASC`,
      [parsed.data.psychologistId],
    );

    res.json({ themes: rows });
  } catch (err) {
    next(err);
  }
});

themesRouter.post("/", async (req, res, next) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, "Invalid payload");
    }

    const { psychologistId, name, description } = parsed.data;

    try {
      const { rows } = await pool.query(
        `INSERT INTO themes (psychologist_id, name, description)
         VALUES ($1, $2, $3)
         RETURNING id, name, description, created_at AS "createdAt"`,
        [psychologistId, name, description ?? null],
      );
      res.status(201).json({ theme: rows[0] });
    } catch (err) {
      if (
        typeof err === "object" &&
        err !== null &&
        (err as { code?: string }).code === "23505"
      ) {
        throw new HttpError(409, "Tema já existe");
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
});

themesRouter.delete("/:id", async (req, res, next) => {
  try {
    const parsed = deleteQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new HttpError(400, "psychologistId is required");
    }

    const { rowCount } = await pool.query(
      `DELETE FROM themes
       WHERE id = $1 AND psychologist_id = $2`,
      [req.params.id, parsed.data.psychologistId],
    );

    if (rowCount === 0) {
      throw new HttpError(404, "Theme not found");
    }

    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
