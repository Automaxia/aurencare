import "dotenv/config";

function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value;
}

export const env = {
  PORT: Number(process.env.PORT ?? 4000),
  DATABASE_URL: required("DATABASE_URL"),
  INTERNAL_API_TOKEN: required("INTERNAL_API_TOKEN"),
  WEB_ORIGIN: process.env.WEB_ORIGIN ?? "http://localhost:3000",
};
