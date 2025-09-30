import { z } from "zod";

export const envSchema = z.object({
  PORT: z.coerce.number().optional(),
  DATABASE_URL: z.string(),
  JWT_KEY: z.string(),
  FRONTEND_URL: z.string().url(),
  RESEND_API_KEY: z.string(),
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  GITHUB_CLIENT_ID: z.string(),
  GITHUB_CLIENT_SECRET: z.string(),
  CLOUDINARY_CLOUD_NAME: z.string(),
  CLOUDINARY_API_KEY: z.string(),
  CLOUDINARY_API_SECRET: z.string(),
  SESSION_SECRET: z.string(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Environment variables validation failed:", parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
