// shortLinks.service.js
import pkg from "pg";
const { Pool } = pkg;
import dotenv from "dotenv";

dotenv.config();

// ✅ Create a reusable connection pool
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ✅ Get paginated short links for a user
export async function getLinks({ userId, limit, offset }) {
  try {
    const shortLinksQuery = `
      SELECT 
        id,
        url,
        short_code AS "shortCode",
        user_id AS "userId",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM short_link
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3;
    `;

    const totalCountQuery = `
      SELECT COUNT(*) AS "totalCounts"
      FROM short_link
      WHERE user_id = $1;
    `;

    const [shortLinksResult, countResult] = await Promise.all([
      pool.query(shortLinksQuery, [userId, limit, offset]),
      pool.query(totalCountQuery, [userId]),
    ]);

    const shortLinks = shortLinksResult.rows;
    const totalCounts = parseInt(countResult.rows[0]?.totalCounts || 0, 10);

    return { shortLinks, totalCounts };
  } catch (err) {
    console.error("Error fetching links:", err);
    throw err;
  }
}

// ✅ Insert new short link
export async function saveToFile({ url, shortCode, userId }) {
  try {
    const query = `
      INSERT INTO short_link (url, short_code, user_id)
      VALUES ($1, $2, $3)
      RETURNING 
        id,
        url,
        short_code AS "shortCode",
        user_id AS "userId",
        created_at AS "createdAt";
    `;
    const { rows } = await pool.query(query, [url, shortCode, userId]);
    return rows[0];
  } catch (err) {
    console.error("Error inserting short link:", err);
    throw err;
  }
}

// ✅ Get short link by short code
export async function getShortLinks(shortCode) {
  try {
    const query = `
      SELECT 
        id,
        url,
        short_code AS "shortCode",
        user_id AS "userId",
        created_at AS "createdAt"
      FROM short_link
      WHERE short_code = $1;
    `;
    const { rows } = await pool.query(query, [shortCode]);
    return rows;
  } catch (err) {
    console.error("Error fetching short link by code:", err);
    throw err;
  }
}

// ✅ Get short link by ID
export async function getShortLinkById(id) {
  try {
    const query = `
      SELECT 
        id,
        url,
        short_code AS "shortCode",
        user_id AS "userId",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM short_link
      WHERE id = $1;
    `;
    const { rows } = await pool.query(query, [id]);
    return rows[0];
  } catch (err) {
    console.error("Error fetching short link by ID:", err);
    throw err;
  }
}

// ✅ Get all short links by user ID
export async function getShortLinkByUserId(userId) {
  try {
    const query = `
      SELECT 
        id,
        url,
        short_code AS "shortCode",
        user_id AS "userId",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM short_link
      WHERE user_id = $1
      ORDER BY created_at DESC;
    `;
    const { rows } = await pool.query(query, [userId]);
    return rows;
  } catch (err) {
    console.error("Error fetching short links by user:", err);
    throw err;
  }
}

// ✅ Update short link
export async function getUpdatedShortCode({ id, url, shortCode }) {
  try {
    const query = `
      UPDATE short_link
      SET url = $1, short_code = $2, updated_at = NOW()
      WHERE id = $3
      RETURNING 
        id,
        url,
        short_code AS "shortCode",
        user_id AS "userId",
        created_at AS "createdAt",
        updated_at AS "updatedAt";
    `;
    const { rows } = await pool.query(query, [url, shortCode, id]);
    return rows[0];
  } catch (err) {
    console.error("Error updating short link:", err);
    throw err;
  }
}

// ✅ Delete short link by ID
export async function deleteShortLinkById(id) {
  try {
    const query = `
      DELETE FROM short_link
      WHERE id = $1
      RETURNING 
        id,
        url,
        short_code AS "shortCode",
        user_id AS "userId",
        created_at AS "createdAt";
    `;
    const { rows } = await pool.query(query, [id]);
    return rows[0];
  } catch (err) {
    console.error("Error deleting short link:", err);
    throw err;
  }
}
