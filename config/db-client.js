// import { drizzle } from "drizzle-orm/postgres-js";
// import postgres from "postgres";
// import dotenv from "dotenv";

// dotenv.config();

// // Render Postgres requires SSL
// const client = postgres(process.env.DATABASE_URL, {
//   ssl: { rejectUnauthorized: false },
// });

// export const db = drizzle(client);





// src/config/db.js
import pkg from "pg";
import dotenv from "dotenv";
dotenv.config();

const { Pool } = pkg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

// optional: basic error logging
pool.on("error", (err) => {
  console.error("Unexpected error on idle client", err);
});

