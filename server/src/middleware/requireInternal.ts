import type { RequestHandler } from "express";
import { env } from "../config/env";

export const requireInternal: RequestHandler = (req, res, next) => {
  const token = req.headers["x-internal-token"];
  if (typeof token !== "string" || token !== env.INTERNAL_API_TOKEN) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
};
