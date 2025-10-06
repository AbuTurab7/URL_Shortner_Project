import { pool } from "../config/db-client.js";
import crypto from "crypto";
import argon2 from "argon2";
import jwt from "jsonwebtoken";
import {
  ACCESS_TOKEN_EXPIRY,
  MILLISECONDS_PER_SECOND,
  REFRESH_TOKEN_EXPIRY,
} from "../config/constant.js";

export const getUserByEmail = async (email) => {
  const { rows } = await pool.query(
    `SELECT * FROM users WHERE email = $1`,
    [email]
  );
  return rows; // matches previous behaviour returning array
};

export const findUserByEmail = async (email) => {
  const { rows } = await pool.query(
    `SELECT * FROM users WHERE email = $1 LIMIT 1`,
    [email]
  );
  return rows[0];
};

export const createUser = async ({ name, email, password }) => {
  const { rows } = await pool.query(
    `INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email, is_email_valid, avatar_url, created_at`,
    [name, email, password]
  );
  return rows[0]; // previously returned id array; adjust callers if needed
};

export const getHashPassword = async (password) => {
  return await argon2.hash(password);
};

export const comparePassword = async (password, hashPassword) => {
  return await argon2.verify(hashPassword, password);
};

export const updateUserPassword = async (userId, password) => {
  const { rows } = await pool.query(
    `UPDATE users SET password = $1, updated_at = now() WHERE id = $2 RETURNING *`,
    [password, userId]
  );
  return rows[0];
};

export const getToken = ({ id, name, email }) => {
  return jwt.sign({ id, name, email }, process.env.JWT_KEY, {
    expiresIn: "30d",
  });
};

export const createSession = async (userId, { ip, userAgent }) => {
  const { rows } = await pool.query(
    `INSERT INTO sessions (user_id, ip, user_agent) VALUES ($1, $2, $3) RETURNING id, user_id, valid, created_at`,
    [userId, ip, userAgent]
  );
  return rows[0];
};

export const createAccessToken = ({ id, name, email, sessionId }) => {
  return jwt.sign({ id, name, email, sessionId }, process.env.JWT_KEY, {
    expiresIn: ACCESS_TOKEN_EXPIRY / MILLISECONDS_PER_SECOND,
  });
};

export const createRefreshToken = (sessionId) => {
  return jwt.sign({ sessionId }, process.env.JWT_KEY, {
    expiresIn: REFRESH_TOKEN_EXPIRY / MILLISECONDS_PER_SECOND,
  });
};

export const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_KEY);
};

export const findSessionById = async (sessionId) => {
  const { rows } = await pool.query(
    `SELECT * FROM sessions WHERE id = $1 LIMIT 1`,
    [sessionId]
  );
  return rows[0];
};

export const findUserById = async (userId) => {
  const { rows } = await pool.query(
    `SELECT * FROM users WHERE id = $1 LIMIT 1`,
    [userId]
  );
  return rows[0];
};

export const refreshTokens = async (refreshToken) => {
  try {
    const decodedToken = verifyToken(refreshToken);
    const currentSession = await findSessionById(decodedToken.sessionId);

    if (!currentSession || !currentSession.valid) {
      throw new Error("Invalid session");
    }
    const user = await findUserById(currentSession.user_id);

    if (!user) throw new Error("Invalid user");

    const userInfo = {
      id: user.id,
      name: user.name,
      email: user.email,
      isEmailValid: user.is_email_valid,
      sessionId: currentSession.id,
    };

    const newAccessToken = createAccessToken(userInfo);
    const newRefreshToken = createRefreshToken(currentSession.id);

    return {
      newAccessToken,
      newRefreshToken,
      user: userInfo,
    };
  } catch (error) {
    console.log("refreshTokens error:", error?.message ?? error);
    throw error;
  }
};

export const deleteCurrentSession = async (sessionId) => {
  await pool.query(`DELETE FROM sessions WHERE id = $1`, [sessionId]);
};

export const generateRandomToken = (digit = 8) => {
  const min = 10 ** (digit - 1);
  const max = 10 ** digit;
  return crypto.randomInt(min, max).toString();
};

export const insertVerifyEmailToken = async ({ userId, token }) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // delete expired tokens
    await client.query(
      `DELETE FROM verify_email_tokens WHERE expires_at < now()`
    );

    // delete any existing token for user
    await client.query(
      `DELETE FROM verify_email_tokens WHERE user_id = $1`,
      [userId]
    );

    // insert new token
    await client.query(
      `INSERT INTO verify_email_tokens (user_id, token) VALUES ($1, $2)`,
      [userId, token.toString()]
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Failed to insert verification token", error);
    throw new Error("Unable to create verification token");
  } finally {
    client.release();
  }
};

export const createVerifyLink = async ({ email, token }) => {
  const url = new URL(`${process.env.FRONTEND_URL}/verify-email-token`);
  url.searchParams.append("token", token);
  url.searchParams.append("email", email);
  return url.toString();
};

export const findVerificationEmailToken = async ({ token, email }) => {
  const { rows } = await pool.query(
    `SELECT u.id as user_id, u.email, v.token, v.expires_at
     FROM verify_email_tokens v
     INNER JOIN users u ON u.id = v.user_id
     WHERE v.token = $1 AND u.email = $2 AND v.expires_at >= now()
     LIMIT 1`,
    [token, email]
  );
  return rows;
};

export const verifyUserEmailAndUpdateToken = async (email) => {
  await pool.query(
    `UPDATE users SET is_email_valid = true, updated_at = now() WHERE email = $1`,
    [email]
  );
};

export const clearVerifyEmailToken = async (userId) => {
  return pool.query(
    `DELETE FROM verify_email_tokens WHERE user_id = $1`,
    [userId]
  );
};

export const updateProfile = async ({ userId, name, avatarUrl }) => {
  return pool.query(
    `UPDATE users SET name = $1, avatar_url = COALESCE($2, avatar_url), updated_at = now() WHERE id = $3 RETURNING *`,
    [name, avatarUrl, userId]
  );
};

export const getForgetPasswordLink = async ({ userId }) => {
  const randomToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto
    .createHash("sha256")
    .update(randomToken)
    .digest("hex");

  // delete existing tokens for user and insert new one
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `DELETE FROM password_reset_tokens WHERE user_id = $1`,
      [userId]
    );
    await client.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash) VALUES ($1, $2)`,
      [userId, tokenHash]
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  return `${process.env.FRONTEND_URL}/reset-password/${randomToken}`;
};

export const getResetPasswordData = async (token) => {
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const { rows } = await pool.query(
    `SELECT * FROM password_reset_tokens WHERE token_hash = $1 AND expires_at >= now() LIMIT 1`,
    [tokenHash]
  );

  return rows[0];
};

export const deleteUserTokenData = async (userId) => {
  await pool.query(
    `DELETE FROM password_reset_tokens WHERE user_id = $1`,
    [userId]
  );
};

export async function getUserWithOauthId({ email, provider }) {
  const { rows } = await pool.query(
    `SELECT u.id, u.name, u.email, u.is_email_valid, oa.provider_account_id, oa.provider
     FROM users u
     LEFT JOIN oauth_accounts oa ON oa.user_id = u.id AND oa.provider = $1
     WHERE u.email = $2
     LIMIT 1`,
    [provider, email]
  );
  return rows[0];
}

export async function linkUserWithOauth({
  userId,
  provider,
  providerAccountId,
  avatarUrl,
}) {
  await pool.query(
    `INSERT INTO oauth_accounts (user_id, provider, provider_account_id) VALUES ($1, $2, $3)`,
    [userId, provider, providerAccountId]
  );

  if (avatarUrl) {
    await pool.query(
      `UPDATE users SET avatar_url = $1 WHERE id = $2 AND avatar_url IS NULL`,
      [avatarUrl, userId]
    );
  }
}

export async function createUserWithOauth({
  name,
  email,
  provider,
  providerAccountId,
  avatarUrl,
}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const insertUser = await client.query(
      `INSERT INTO users (email, name, avatar_url, is_email_valid) VALUES ($1, $2, $3, true) RETURNING id, name, email, is_email_valid`,
      [email, name, avatarUrl]
    );
    const userRow = insertUser.rows[0];

    await client.query(
      `INSERT INTO oauth_accounts (provider, provider_account_id, user_id) VALUES ($1, $2, $3)`,
      [provider, providerAccountId, userRow.id]
    );

    await client.query("COMMIT");

    return {
      id: userRow.id,
      name,
      email,
      isEmailValid: true,
      provider,
      providerAccountId,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
