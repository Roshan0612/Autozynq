import { prisma } from "@/lib/prisma";

async function testConnection() {
  try {
    console.log("Testing database connection...");
    const count = await prisma.user.count();
    console.log("✅ Database connected successfully!");
    console.log(`Found ${count} user(s) in database`);
    return true;
  } catch (error) {
    console.error("❌ Database connection failed:");
    console.error(error instanceof Error ? error.message : String(error));
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();
