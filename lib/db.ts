import { neon } from "@neondatabase/serverless";

export function sql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not defined");
  return neon(url);
}

export async function initSchema() {
  const db = sql();
  await db`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      role VARCHAR(50) DEFAULT 'user',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await db`
    CREATE TABLE IF NOT EXISTS cases (
      id SERIAL PRIMARY KEY,
      customer_name VARCHAR(255) NOT NULL,
      status VARCHAR(100) DEFAULT '未実行',
      next_meeting TIMESTAMP,
      sales_person VARCHAR(255),
      appointer VARCHAR(255),
      notes TEXT,
      contracted_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await db`
    CREATE TABLE IF NOT EXISTS targets (
      id SERIAL PRIMARY KEY,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      target_count INTEGER DEFAULT 0,
      UNIQUE(year, month)
    )
  `;
}
