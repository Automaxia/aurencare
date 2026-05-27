import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env";
import { errorHandler } from "./middleware/error";
import { requireInternal } from "./middleware/requireInternal";
import { authRouter } from "./modules/auth/auth.routes";
import { chargesRouter } from "./modules/charges/charges.routes";
import { goalsRouter } from "./modules/goals/goals.routes";
import { healthRouter } from "./modules/health/health.routes";
import { notesRouter } from "./modules/notes/notes.routes";
import { patientsRouter } from "./modules/patients/patients.routes";
import { sessionsRouter } from "./modules/sessions/sessions.routes";
import { themesRouter } from "./modules/themes/themes.routes";

export const app = express();

app.use(helmet());
app.use(cors({ origin: env.WEB_ORIGIN, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

app.use("/health", healthRouter);
app.use("/auth", authRouter);
app.use("/patients", requireInternal, patientsRouter);
app.use("/sessions", requireInternal, sessionsRouter);
app.use("/goals", requireInternal, goalsRouter);
app.use("/notes", requireInternal, notesRouter);
app.use("/themes", requireInternal, themesRouter);
app.use("/charges", requireInternal, chargesRouter);

app.use(errorHandler);
