import { Router } from "express";
import { z } from "zod";
import { pool } from "../../db/pool";
import { HttpError } from "../../middleware/error";

export const patientsRouter = Router();

const createSchema = z.object({
  psychologistId: z.string().uuid(),
  fullName: z.string().min(1).max(255),
  email: z.string().email().optional(),
  phone: z.string().max(50).optional(),
  birthDate: z.string().date().optional(),
  notes: z.string().optional(),
});

const listQuerySchema = z.object({
  psychologistId: z.string().uuid(),
});

patientsRouter.get("/", async (req, res, next) => {
  try {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new HttpError(400, "psychologistId is required");
    }

    const { rows } = await pool.query(
      `SELECT id,
              full_name   AS "fullName",
              email,
              phone,
              birth_date  AS "birthDate",
              status,
              created_at  AS "createdAt"
       FROM patients
       WHERE psychologist_id = $1
       ORDER BY full_name ASC`,
      [parsed.data.psychologistId],
    );

    res.json({ patients: rows });
  } catch (err) {
    next(err);
  }
});

patientsRouter.post("/", async (req, res, next) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, "Invalid payload");
    }

    const { psychologistId, fullName, email, phone, birthDate, notes } =
      parsed.data;

    const { rows } = await pool.query(
      `INSERT INTO patients
         (psychologist_id, full_name, email, phone, birth_date, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id,
                 full_name   AS "fullName",
                 email,
                 phone,
                 birth_date  AS "birthDate",
                 status,
                 created_at  AS "createdAt"`,
      [psychologistId, fullName, email, phone, birthDate, notes],
    );

    res.status(201).json({ patient: rows[0] });
  } catch (err) {
    next(err);
  }
});
