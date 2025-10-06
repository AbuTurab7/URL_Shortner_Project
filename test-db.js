import postgres from 'postgres';
import dotenv from 'dotenv';
dotenv.config();

const sql = postgres(process.env.DATABASE_URL, { ssl: { rejectUnauthorized: false } });

async function testConnection() {
  try {
    const result = await sql`SELECT 1`;
    console.log(result); // [ { '?column?': 1 } ]
  } catch (err) {
    console.error(err);
  }
}

testConnection();
