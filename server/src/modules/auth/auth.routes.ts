import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { pool } from "../../db/pool";

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

type UserRow = {
  id: string;
  email: string;
  name: string;
  password_hash: string;
};

authRouter.post("/login", async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid payload" });
      return;
    }

    const { email, password } = parsed.data;

    const { rows } = await pool.query<UserRow>(
      `SELECT id, email, name, password_hash
       FROM users
       WHERE email = $1`,
      [email],
    );

    const user = rows[0];
    if (!user) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    res.json({ id: user.id, email: user.email, name: user.name });
  } catch (err) {
    next(err);
  }
});
