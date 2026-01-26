#!/usr/bin/env ts-node

import { prisma } from "@/lib/prisma";

/**
 * Fix workflow templates to use correct node IDs and answer field names
 * Specifically:
 * 1. Replace node_9dkRPJ references with the actual trigger node ID
 * 2. Use lowercase field names for answers
 */

async function fixWorkflows() {
  console.log("🔧 Starting workflow template migration...\n");

  const workflows = await prisma.workflow.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true, definition: true },
  });

  console.log(`Found ${workflows.length} active workflow(s)\n`);

  for (const workflow of workflows) {
    const def = workflow.definition as any;
    if (!def.nodes || !def.edges) {
      console.log(`⏭️  Skipping ${workflow.name} (no nodes/edges)`);
      continue;
    }

    // Find trigger node - check both category and type fields
    let triggerNode = def.nodes.find((n: any) => 
      n.category === "trigger" || 
      n.nodeType?.includes("trigger") || 
      n.type?.includes("trigger") ||
      (n as any).nodeType?.includes("google_forms")
    );
    
    if (!triggerNode) {
      console.log(`⏭️  Skipping ${workflow.name} (trigger node not found). First node:`, def.nodes[0]);
      continue;
    }

    console.log(`📋 ${workflow.name}`);
    console.log(`   Trigger node ID: ${triggerNode.id}`);

    let changed = false;

    // Fix Gmail nodes referencing wrong node IDs
    const gmailNodes = def.nodes.filter((n: any) => n.type?.includes("gmail"));
    for (const gmail of gmailNodes) {
      const config = gmail.config || {};
      
      console.log(`   Gmail node (${gmail.id}):`);
      
      // Fix "To" field
      if (config.to && config.to.includes("node_9dkRPJ")) {
        const newTo = config.to.replace(/node_9dkRPJ/g, triggerNode.id);
        console.log(`     ✏️  "To" field: ${config.to} → ${newTo}`);
        gmail.config.to = newTo;
        changed = true;
      }

      // Fix "Subject" field
      if (config.subject && config.subject.includes("node_9dkRPJ")) {
        const newSubject = config.subject.replace(/node_9dkRPJ/g, triggerNode.id);
        console.log(`     ✏️  "Subject" field: fixed`);
        gmail.config.subject = newSubject;
        changed = true;
      }

      // Fix "Body HTML" field
      if (config.bodyHtml && config.bodyHtml.includes("node_9dkRPJ")) {
        const newBody = config.bodyHtml.replace(/node_9dkRPJ/g, triggerNode.id);
        console.log(`     ✏️  "Body HTML" field: fixed`);
        gmail.config.bodyHtml = newBody;
        changed = true;
      }
    }

    if (changed) {
      await prisma.workflow.update({
        where: { id: workflow.id },
        data: { definition: def as any },
      });
      console.log(`   ✅ Updated workflow\n`);
    } else {
      console.log(`   ✅ No changes needed\n`);
    }
  }

  console.log("🎉 Migration complete!");
}

fixWorkflows()
  .catch((e) => {
    console.error("❌ Migration failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
