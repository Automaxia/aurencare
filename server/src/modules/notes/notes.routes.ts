import { Router } from "express";
import { z } from "zod";
import { pool } from "../../db/pool";
import { HttpError } from "../../middleware/error";

export const notesRouter = Router();

const MOODS = ["positive", "neutral", "challenging"] as const;

const listQuerySchema = z.object({
  psychologistId: z.string().uuid(),
  patientId: z.string().uuid().optional(),
  themeId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

const createSchema = z.object({
  psychologistId: z.string().uuid(),
  patientId: z.string().uuid(),
  sessionId: z.string().uuid().optional(),
  recordedAt: z.string().datetime().optional(),
  content: z.string().min(1).max(10000),
  mood: z.enum(MOODS).optional(),
  themeIds: z.array(z.string().uuid()).optional(),
});

type ThemeRef = { id: string; name: string };

type Row = {
  id: string;
  recordedAt: string;
  content: string;
  mood: string | null;
  sessionId: string | null;
  createdAt: string;
  patientId: string;
  patientName: string;
  themes: ThemeRef[] | null;
};

notesRouter.get("/", async (req, res, next) => {
  try {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new HttpError(400, "psychologistId is required");
    }

    const { psychologistId, patientId, themeId, limit } = parsed.data;

    const { rows } = await pool.query<Row>(
      `SELECT n.id,
              n.recorded_at  AS "recordedAt",
              n.content,
              n.mood,
              n.session_id   AS "sessionId",
              n.created_at   AS "createdAt",
              p.id           AS "patientId",
              p.full_name    AS "patientName",
              (
                SELECT COALESCE(
                  json_agg(json_build_object('id', t.id, 'name', t.name) ORDER BY t.name),
                  '[]'::json
                )
                FROM note_themes nt
                JOIN themes t ON t.id = nt.theme_id
                WHERE nt.note_id = n.id
              ) AS themes
       FROM notes n
       JOIN patients p ON p.id = n.patient_id
       WHERE n.psychologist_id = $1
         AND ($2::uuid IS NULL OR n.patient_id = $2::uuid)
         AND ($3::uuid IS NULL OR EXISTS (
           SELECT 1 FROM note_themes nt
           WHERE nt.note_id = n.id AND nt.theme_id = $3::uuid
         ))
       ORDER BY n.recorded_at DESC
       LIMIT $4`,
      [psychologistId, patientId ?? null, themeId ?? null, limit ?? 100],
    );

    res.json({
      notes: rows.map((row) => ({
        id: row.id,
        recordedAt: row.recordedAt,
        content: row.content,
        mood: row.mood,
        sessionId: row.sessionId,
        createdAt: row.createdAt,
        patient: { id: row.patientId, fullName: row.patientName },
        themes: row.themes ?? [],
      })),
    });
  } catch (err) {
    next(err);
  }
});

notesRouter.post("/", async (req, res, next) => {
  const client = await pool.connect();
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, "Invalid payload");
    }

    const {
      psychologistId,
      patientId,
      sessionId,
      recordedAt,
      content,
      mood,
      themeIds,
    } = parsed.data;

    const ownership = await client.query(
      `SELECT 1 FROM patients
       WHERE id = $1 AND psychologist_id = $2`,
      [patientId, psychologistId],
    );
    if (ownership.rowCount === 0) {
      throw new HttpError(404, "Patient not found");
    }

    if (sessionId) {
      const sessionOwner = await client.query(
        `SELECT 1 FROM sessions
         WHERE id = $1 AND psychologist_id = $2 AND patient_id = $3`,
        [sessionId, psychologistId, patientId],
      );
      if (sessionOwner.rowCount === 0) {
        throw new HttpError(404, "Session not found");
      }
    }

    const dedupedThemeIds = themeIds ? Array.from(new Set(themeIds)) : [];
    if (dedupedThemeIds.length > 0) {
      const { rowCount: validCount } = await client.query(
        `SELECT 1 FROM themes
         WHERE id = ANY($1::uuid[]) AND psychologist_id = $2`,
        [dedupedThemeIds, psychologistId],
      );
      if (validCount !== dedupedThemeIds.length) {
        throw new HttpError(400, "Invalid themeIds");
      }
    }

    await client.query("BEGIN");

    const { rows } = await client.query(
      `INSERT INTO notes
         (psychologist_id, patient_id, session_id, recorded_at, content, mood)
       VALUES ($1, $2, $3, COALESCE($4, NOW()), $5, $6)
       RETURNING id,
                 recorded_at  AS "recordedAt",
                 content,
                 mood,
                 session_id   AS "sessionId",
                 created_at   AS "createdAt"`,
      [
        psychologistId,
        patientId,
        sessionId ?? null,
        recordedAt ?? null,
        content,
        mood ?? null,
      ],
    );

    const noteId = rows[0].id as string;

    if (dedupedThemeIds.length > 0) {
      await client.query(
        `INSERT INTO note_themes (note_id, theme_id)
         SELECT $1, unnest($2::uuid[])`,
        [noteId, dedupedThemeIds],
      );
    }

    await client.query("COMMIT");

    res.status(201).json({ note: rows[0] });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    next(err);
  } finally {
    client.release();
  }
});
