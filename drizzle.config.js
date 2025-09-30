import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./drizzle/schema.js",
  out: "./drizzle/migrations",

  // 👇 must be one of: 'postgresql' | 'mysql' | 'sqlite' | ...
  dialect: "postgresql",  

  dbCredentials: {
    url: process.env.DATABASE_URL,  // 👈 works with Railway Postgres
  },
});
