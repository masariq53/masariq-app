import "./load-env.js";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { paymentMethodSettings } from "../drizzle/schema";

async function seed() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL!);
  const db = drizzle(conn);

  const rows = [
    {
      method: "mastercard" as const,
      displayName: "ماستر كارد",
      accountNumber: "4111-1111-1111-1111",
      accountName: "شركة مسار للنقل",
      instructions: "قم بالتحويل إلى رقم البطاقة أعلاه ثم أرفق وصل التحويل",
      isActive: true,
    },
    {
      method: "zaincash" as const,
      displayName: "زين كاش",
      accountNumber: "+9647700000000",
      accountName: "شركة مسار للنقل",
      instructions: "قم بالتحويل عبر تطبيق زين كاش إلى الرقم أعلاه ثم أرفق وصل التحويل",
      isActive: true,
    },
    {
      method: "fib" as const,
      displayName: "مصرف العراق الأول (FIB)",
      accountNumber: "IQ12FIB0000000000000",
      accountName: "شركة مسار للنقل",
      instructions: "قم بالتحويل عبر تطبيق FIB إلى رقم الحساب أعلاه ثم أرفق وصل التحويل",
      isActive: true,
    },
  ];

  for (const row of rows) {
    await db.insert(paymentMethodSettings).values(row).onDuplicateKeyUpdate({ set: { updatedAt: new Date() } });
  }

  console.log("✅ Payment methods seeded");
  await conn.end();
}

seed().catch(console.error);
