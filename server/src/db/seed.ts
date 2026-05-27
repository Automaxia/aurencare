import bcrypt from "bcryptjs";
import { pool } from "./pool";

const DEMO_EMAIL = "ana@aurencare.com";
const DEMO_PASSWORD = "auren123";

async function seed() {
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);

  await pool.query(
    `INSERT INTO users (email, password_hash, name, role)
     VALUES ($1, $2, $3, 'psychologist')
     ON CONFLICT (email) DO NOTHING`,
    [DEMO_EMAIL, hash, "Dra. Ana"],
  );

  console.log(`Usuário demo: ${DEMO_EMAIL}  /  senha: ${DEMO_PASSWORD}`);
}

seed()
  .then(() => pool.end())
  .catch(async (err) => {
    console.error(err);
    await pool.end();
    process.exit(1);
  });
