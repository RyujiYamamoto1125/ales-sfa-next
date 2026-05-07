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
      contact_person VARCHAR(255),
      email_address VARCHAR(255),
      phone VARCHAR(50),
      status VARCHAR(100) DEFAULT '未実行',
      next_meeting TIMESTAMP,
      sales_person VARCHAR(255),
      appointer VARCHAR(255),
      notes TEXT,
      contracted_at TIMESTAMP,
      amount INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await db`ALTER TABLE cases ADD COLUMN IF NOT EXISTS amount INTEGER DEFAULT 0`;
  await db`ALTER TABLE cases ADD COLUMN IF NOT EXISTS contact_person VARCHAR(255)`;
  await db`ALTER TABLE cases ADD COLUMN IF NOT EXISTS email_address VARCHAR(255)`;
  await db`ALTER TABLE cases ADD COLUMN IF NOT EXISTS phone VARCHAR(50)`;
  await db`ALTER TABLE cases ADD COLUMN IF NOT EXISTS initial_fee INTEGER DEFAULT 0`;
  await db`ALTER TABLE cases ADD COLUMN IF NOT EXISTS monthly_fee INTEGER DEFAULT 0`;
  await db`ALTER TABLE cases ADD COLUMN IF NOT EXISTS contract_return_date DATE`;
  await db`ALTER TABLE cases ADD COLUMN IF NOT EXISTS first_deduction_date DATE`;
  await db`ALTER TABLE cases ADD COLUMN IF NOT EXISTS lead_source VARCHAR(100)`;
  await db`ALTER TABLE cases ADD COLUMN IF NOT EXISTS document_request_date DATE`;
  await db`ALTER TABLE cases ADD COLUMN IF NOT EXISTS position VARCHAR(255)`;
  await db`ALTER TABLE cases ADD COLUMN IF NOT EXISTS furigana VARCHAR(255)`;

  await db`
    CREATE TABLE IF NOT EXISTS targets (
      id SERIAL PRIMARY KEY,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      target_count INTEGER DEFAULT 0,
      UNIQUE(year, month)
    )
  `;

  await db`
    CREATE TABLE IF NOT EXISTS sales_targets (
      id SERIAL PRIMARY KEY,
      sales_person VARCHAR(255) NOT NULL,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      target_contracts INTEGER DEFAULT 0,
      target_amount INTEGER DEFAULT 0,
      UNIQUE(sales_person, year, month)
    )
  `;

  await db`
    CREATE TABLE IF NOT EXISTS leads (
      id SERIAL PRIMARY KEY,
      date DATE NOT NULL,
      medium VARCHAR(100) NOT NULL,
      lead_count INTEGER DEFAULT 0,
      UNIQUE(date, medium)
    )
  `;

  await db`
    CREATE TABLE IF NOT EXISTS ad_metrics (
      id SERIAL PRIMARY KEY,
      date DATE NOT NULL,
      medium VARCHAR(100) NOT NULL,
      ad_spend BIGINT DEFAULT 0,
      dashboard_cv INTEGER DEFAULT 0,
      actual_cv INTEGER DEFAULT 0,
      clicks INTEGER DEFAULT 0,
      impressions INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(date, medium)
    )
  `;
}
