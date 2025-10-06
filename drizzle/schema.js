import { relations, sql } from "drizzle-orm";
import {
  boolean,
  integer,
  serial,
  timestamp,
  varchar,
  text,
  pgEnum,
  pgTable,
} from "drizzle-orm/pg-core";

// ----------------- USERS -----------------
export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: varchar("password", { length: 255 }),
  avatarUrl: text("avatar_url"),
  isEmailValid: boolean("is_email_valid").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(), // update in code
});

// ----------------- SHORT LINKS -----------------
export const shortLinksTable = pgTable("short_link", {
  id: serial("id").primaryKey(),
  url: varchar("url", { length: 255 }).notNull(),
  shortCode: varchar("short_code", { length: 20 }).notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id),
});

// ----------------- VERIFY EMAIL TOKENS -----------------
export const verifyEmailTokensTable = pgTable("verify_email_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 8 }).notNull(),
  expiresAt: timestamp("expires_at")
    .default(sql`CURRENT_TIMESTAMP + INTERVAL '1 day'`)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ----------------- SESSIONS -----------------
export const sessionsTable = pgTable("sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  valid: boolean("valid").default(true).notNull(),
  userAgent: text("user_agent"),
  ip: varchar("ip", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ----------------- PASSWORD RESET TOKENS -----------------
export const passwordResetTokensTable = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" })
    .unique(),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at")
    .default(sql`CURRENT_TIMESTAMP + INTERVAL '1 hour'`)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ----------------- OAUTH ACCOUNTS -----------------
export const providerEnum = pgEnum("provider", ["google", "github"]);

export const oauthAccountsTable = pgTable("oauth_accounts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  provider: providerEnum("provider").notNull(),
  providerAccountId: varchar("provider_account_id", { length: 255 })
    .notNull()
    .unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ----------------- RELATIONS -----------------
export const usersRelation = relations(usersTable, ({ many }) => ({
  shortLink: many(shortLinksTable),
  session: many(sessionsTable),
}));

export const shortLinksRelation = relations(shortLinksTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [shortLinksTable.userId],
    references: [usersTable.id],
  }),
}));

export const sessionsRelation = relations(sessionsTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [sessionsTable.userId],
    references: [usersTable.id],
  }),
}));
