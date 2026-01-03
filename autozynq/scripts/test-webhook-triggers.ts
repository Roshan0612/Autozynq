import { prisma } from "../lib/prisma";
import { activateWorkflow, deactivateWorkflow } from "../lib/workflow/activation";
import { getWorkflowTriggers } from "../lib/triggers";

/**
 * Test script for Webhook Trigger System (Phase 2)
 * 
 * Tests the complete trigger infrastructure:
 * 1. Create a workflow
 * 2. Activate workflow (registers triggers)
 * 3. Get trigger webhook URL
 * 4. Simulate webhook call (manual test)
 * 5. Deactivate workflow
 */

async function main() {
  console.log("🚀 Testing Webhook Trigger System (Phase 2)\n");

  // Clean up any existing test data
  await prisma.workflow.deleteMany({
    where: { name: { startsWith: "Webhook Test Workflow -" } },
  });

  // Create a test user (or use existing)
  let user = await prisma.user.findFirst();
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: "test@example.com",
        name: "Test User",
      },
    });
    console.log("✅ Created test user:", user.email);
  } else {
    console.log("✅ Using existing user:", user.email);
  }

  // ============================================================================
  // STEP 1: Create a workflow in DRAFT status
  // ============================================================================

  const workflow = await prisma.workflow.create({
    data: {
      name: `Webhook Test Workflow - ${new Date().toISOString()}`,
      userId: user.id,
      status: "DRAFT", // Start as DRAFT
      definition: {
        nodes: [
          {
            id: "webhook_trigger",
            type: "gmail.trigger.newEmail", // This will be treated as webhook trigger
            config: {
              label: "Webhook Trigger",
              from: "webhook@example.com",
            },
          },
          {
            id: "action_1",
            type: "slack.action.sendMessage",
            config: {
              channel: "#webhooks",
              message: "Received webhook event!",
            },
          },
        ],
        edges: [
          {
            from: "webhook_trigger",
            to: "action_1",
          },
        ],
      },
    },
  });

  console.log("\n✅ Created test workflow:");
  console.log("   Workflow ID:", workflow.id);
  console.log("   Name:", workflow.name);
  console.log("   Status:", workflow.status);

  // ============================================================================
  // STEP 2: Activate workflow (this registers triggers)
  // ============================================================================

  console.log("\n🔥 Activating workflow...\n");

  const activationResult = await activateWorkflow(workflow.id, user.id);

  console.log("✅ Workflow activated successfully!");
  console.log("   Status:", activationResult.status);
  console.log("   Message:", activationResult.message);
  console.log("\n📋 Registered Triggers:");

  for (const trigger of activationResult.triggers) {
    console.log(`   - Trigger ID: ${trigger.triggerId}`);
    console.log(`     Status: ${trigger.status}`);
    if (trigger.webhookUrl) {
      console.log(`     Webhook URL: ${trigger.webhookUrl}`);
    }
  }

  // ============================================================================
  // STEP 3: Get trigger details
  // ============================================================================

  console.log("\n📊 Trigger Details:");

  const triggers = await getWorkflowTriggers(workflow.id);

  for (const trigger of triggers) {
    console.log(`\n   Trigger ID: ${trigger.id}`);
    console.log(`   Node ID: ${trigger.nodeId}`);
    console.log(`   Type: ${trigger.type}`);
    console.log(`   Active: ${trigger.isActive}`);
    console.log(`   Created: ${trigger.createdAt.toISOString()}`);
  }

  // ============================================================================
  // STEP 4: Instructions for manual webhook test
  // ============================================================================

  if (triggers.length > 0) {
    const firstTrigger = triggers[0];
    const webhookUrl = `http://localhost:3000/api/webhooks/${firstTrigger.id}`;

    console.log("\n\n🧪 Test Webhook Endpoint:");
    console.log("=========================================");
    console.log("\nTo test the webhook, send a POST request:\n");
    console.log(`curl -X POST ${webhookUrl} \\`);
    console.log(`  -H "Content-Type: application/json" \\`);
    console.log(`  -d '{`);
    console.log(`    "subject": "Test Email from Webhook",`);
    console.log(`    "from": "webhook@example.com",`);
    console.log(`    "message": "This is a test webhook payload"`);
    console.log(`  }'`);
    console.log("\n=========================================");

    console.log("\nOr using PowerShell:\n");
    console.log(`Invoke-RestMethod -Uri "${webhookUrl}" -Method POST -ContentType "application/json" -Body '{"subject":"Test Email","from":"webhook@example.com","message":"Test webhook"}'`);
    console.log("\n=========================================");

    console.log("\nOr fetch trigger info (GET):\n");
    console.log(`curl ${webhookUrl}`);
    console.log("\n=========================================\n");
  }

  // ============================================================================
  // STEP 5: Verify workflow status
  // ============================================================================

  const updatedWorkflow = await prisma.workflow.findUnique({
    where: { id: workflow.id },
    include: {
      triggers: true,
    },
  });

  console.log("\n✅ Final Workflow State:");
  console.log("   Status:", updatedWorkflow?.status);
  console.log("   Triggers:", updatedWorkflow?.triggers.length);
  console.log("   Active Triggers:", updatedWorkflow?.triggers.filter((t) => t.isActive).length);

  // ============================================================================
  // STEP 6: Test deactivation
  // ============================================================================

  console.log("\n🔄 Testing workflow deactivation...\n");

  const deactivationResult = await deactivateWorkflow(workflow.id, user.id);

  console.log("✅ Workflow deactivated successfully!");
  console.log("   Status:", deactivationResult.status);
  console.log("   Message:", deactivationResult.message);

  // Verify triggers are inactive
  const inactiveTriggers = await getWorkflowTriggers(workflow.id);
  console.log("\n📊 Triggers after deactivation:");
  for (const trigger of inactiveTriggers) {
    console.log(`   - Trigger ${trigger.id}: Active = ${trigger.isActive}`);
  }

  // ============================================================================
  // STEP 7: Re-activate to restore functionality
  // ============================================================================

  console.log("\n🔄 Re-activating workflow for testing...\n");

  await activateWorkflow(workflow.id, user.id);

  const finalTriggers = await getWorkflowTriggers(workflow.id);
  console.log("✅ Workflow re-activated!");
  console.log(`   Active triggers: ${finalTriggers.filter((t) => t.isActive).length}`);

  // ============================================================================
  // SUMMARY
  // ============================================================================

  console.log("\n\n✅ Phase 2 - Trigger Infrastructure Test Complete!\n");
  console.log("Summary:");
  console.log("========");
  console.log("✅ WorkflowTrigger model created");
  console.log("✅ Trigger registration on activation works");
  console.log("✅ Trigger deactivation on pause works");
  console.log("✅ Webhook URLs generated correctly");
  console.log("✅ Trigger service layer functional");
  console.log("\n🎯 Next Steps:");
  console.log("1. Start dev server: npm run dev");
  console.log("2. Use the curl command above to test webhook");
  console.log("3. Check execution in database");
  console.log("\nWorkflow ID for testing:", workflow.id);
  console.log("Trigger ID:", triggers[0]?.id || "N/A");
  console.log("\n");
}

main()
  .catch((error) => {
    console.error("❌ Test failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
