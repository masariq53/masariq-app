/**
 * Seed default commission settings
 * Run: npx tsx scripts/seed-commissions.ts
 */
import "../scripts/load-env.js";
import { drizzle } from "drizzle-orm/mysql2";
import { commissionSettings } from "../drizzle/schema";
import { sql } from "drizzle-orm";

async function seed() {
  if (!process.env.DATABASE_URL) {
    console.error("No DATABASE_URL");
    process.exit(1);
  }
  const db = drizzle(process.env.DATABASE_URL);

  // Insert default commission settings (ignore if already exist)
  await db.execute(sql`
    INSERT IGNORE INTO commissionSettings (serviceType, commissionRate, isActive)
    VALUES 
      ('city_ride', 10.00, 1),
      ('intercity', 10.00, 1),
      ('parcel', 10.00, 1)
  `);

  console.log("✅ Commission settings seeded successfully");
  process.exit(0);
}

seed().catch((e) => { console.error(e); process.exit(1); });
