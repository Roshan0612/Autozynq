#!/usr/bin/env ts-node

import { prisma } from "@/lib/prisma";

/**
 * Reset Google Forms trigger to reprocess responses
 * Useful for testing
 */

async function resetTriggers() {
  console.log("🔄 Resetting Google Forms triggers...\n");

  const triggers = await prisma.googleFormsTrigger.findMany({
    select: { id: true, triggerId: true, formId: true, lastResponseId: true },
  });

  console.log(`Found ${triggers.length} trigger(s)\n`);

  for (const t of triggers) {
    console.log(`Trigger: ${t.triggerId}`);
    console.log(`  Form ID: ${t.formId}`);
    console.log(`  Last Response ID: ${t.lastResponseId}`);

    // Clear lastResponseId to reprocess all responses
    await prisma.googleFormsTrigger.update({
      where: { id: t.id },
      data: { lastResponseId: null, lastCheckedAt: null },
    });

    console.log(`  ✅ Reset - will reprocess all responses on next poll\n`);
  }

  console.log("🎉 Reset complete!");
}

resetTriggers()
  .catch((e) => {
    console.error("❌ Reset failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
