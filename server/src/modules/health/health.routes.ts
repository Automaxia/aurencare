import { Router } from "express";
import { pool } from "../../db/pool";

export const healthRouter = Router();

healthRouter.get("/", async (_req, res, next) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok" });
  } catch (err) {
    next(err);
  }
});
