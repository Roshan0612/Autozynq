#!/usr/bin/env ts-node

import { prisma } from "@/lib/prisma";

async function resetNow() {
  console.log("🔄 Forcing reset of lastResponseId...\n");

  const updated = await prisma.googleFormsTrigger.updateMany({
    data: { lastResponseId: null, lastCheckedAt: null }
  });

  console.log(`✅ Reset ${updated.count} trigger(s)`);

  const triggers = await prisma.googleFormsTrigger.findMany({
    select: { id: true, lastResponseId: true, triggerId: true }
  });

  triggers.forEach(t => {
    console.log(`  Trigger ${t.triggerId}: lastResponseId = ${t.lastResponseId || 'NULL'}`);
  });

  await prisma.$disconnect();
}

resetNow().catch(e => {
  console.error("❌ Error:", e);
  process.exit(1);
});
