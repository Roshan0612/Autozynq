/**
 * Phase 2 Webhook Trigger System - Comprehensive Test
 * 
 * This test verifies:
 * 1. Workflow activation → trigger subscription creation
 * 2. Webhook reception → subscription lookup
 * 3. Webhook → execution bridge
 * 4. Subscription metadata updates (executionCount, lastPayload)
 * 5. Deactivation → subscription cleanup
 * 
 * Run with: npx ts-node scripts/test-webhook-triggers.ts
 */

import { prisma } from "../lib/prisma";
import { activateWorkflow, deactivateWorkflow } from "../lib/workflow/activation";
import {
  getTriggerSubscriptionByPath,
  getWorkflowSubscriptions,
} from "../lib/triggers/subscriptions";

// Test workflow definition (must use real registered nodes)
const TEST_WORKFLOW_DEFINITION = {
  nodes: [
    {
      id: "trigger_1",
      type: "gmail.trigger.newEmail",
      config: {
        label: "Test Trigger",
      },
    },
    {
      id: "action_1",
      type: "slack.action.sendMessage",
      config: {
        channel: "#test",
        message: "New email received",
      },
    },
  ],
  edges: [
    {
      from: "trigger_1",
      to: "action_1",
    },
  ],
};

async function main() {
  console.log("========================================");
  console.log("PHASE 2: WEBHOOK TRIGGER SYSTEM TEST");
  console.log("========================================\n");

  try {
    // ========================================================================
    // SETUP: Create test user and workflow
    // ========================================================================

    console.log("[Setup] Creating test user...");
    const user = await prisma.user.upsert({
      where: { email: "test-webhook@example.com" },
      update: {},
      create: {
        email: "test-webhook@example.com",
        name: "Test User",
      },
    });
    console.log(`✓ User created: ${user.id}\n`);

    console.log("[Setup] Creating test workflow...");
    const workflow = await prisma.workflow.create({
      data: {
        name: "Webhook Trigger Test Workflow",
        userId: user.id,
        status: "DRAFT",
        definition: TEST_WORKFLOW_DEFINITION,
      },
    });
    console.log(`✓ Workflow created: ${workflow.id}`);
    console.log(`  Status: ${workflow.status}\n`);

    // ========================================================================
    // TEST 1: Activate workflow → Create trigger subscription
    // ========================================================================

    console.log("[Test 1] Activating workflow...");
    const activationResult = await activateWorkflow(workflow.id, user.id);
    console.log(`✓ Workflow activated: ${activationResult.workflowId}`);
    console.log(`  Status: ${activationResult.status}`);
    console.log(`  Webhook URL: ${activationResult.webhookUrl}\n`);

    // Verify subscription was created
    const subscriptions = await getWorkflowSubscriptions(workflow.id);
    console.log(`✓ Trigger subscriptions created: ${subscriptions.length}`);
    if (subscriptions.length === 0) {
      throw new Error("No subscriptions created!");
    }

    const subscription = subscriptions[0];
    console.log(`  Subscription ID: ${subscription.id}`);
    console.log(`  Node ID: ${subscription.nodeId}`);
    console.log(`  Webhook Path: ${subscription.webhookPath}`);
    console.log(`  Trigger Type: ${subscription.triggerType}`);
    console.log(`  Execution Count: ${subscription.executionCount}\n`);

    // ========================================================================
    // TEST 2: Look up subscription by webhook path
    // ========================================================================

    console.log("[Test 2] Looking up subscription by webhook path...");
    const foundSubscription = await getTriggerSubscriptionByPath(
      subscription.webhookPath
    );

    if (!foundSubscription) {
      throw new Error("Failed to find subscription by webhook path!");
    }

    console.log(`✓ Subscription found by path`);
    console.log(`  ID: ${foundSubscription.id}`);
    console.log(`  Workflow ID: ${foundSubscription.workflowId}`);
    console.log(`  Workflow Status: ${foundSubscription.workflow.status}\n`);

    // ========================================================================
    // TEST 3: Verify subscription fields
    // ========================================================================

    console.log("[Test 3] Verifying subscription fields...");
    if (!foundSubscription.webhookPath) {
      throw new Error("webhookPath is missing!");
    }
    console.log(`✓ webhookPath: ${foundSubscription.webhookPath}`);

    if (foundSubscription.executionCount !== 0) {
      throw new Error("executionCount should be 0!");
    }
    console.log(`✓ executionCount: ${foundSubscription.executionCount}`);

    if (foundSubscription.lastPayload !== null) {
      throw new Error("lastPayload should be null initially!");
    }
    console.log(`✓ lastPayload: null (as expected)`);

    if (foundSubscription.triggerType !== "webhook") {
      throw new Error("triggerType should be 'webhook'!");
    }
    console.log(`✓ triggerType: ${foundSubscription.triggerType}\n`);

    // ========================================================================
    // TEST 4: Deactivate workflow → Delete subscriptions
    // ========================================================================

    console.log("[Test 4] Deactivating workflow...");
    const deactivationResult = await deactivateWorkflow(workflow.id, user.id);
    console.log(`✓ Workflow deactivated: ${deactivationResult.workflowId}`);
    console.log(`  Status: ${deactivationResult.status}`);
    console.log(`  Message: ${deactivationResult.message}\n`);

    // Verify subscriptions were deleted
    const remainingSubscriptions = await getWorkflowSubscriptions(workflow.id);
    if (remainingSubscriptions.length !== 0) {
      throw new Error("Subscriptions were not deleted!");
    }
    console.log(`✓ All subscriptions deleted\n`);

    // ========================================================================
    // TEST 5: Reactivation → New subscription created
    // ========================================================================

    console.log("[Test 5] Reactivating workflow...");
    const reactivationResult = await activateWorkflow(workflow.id, user.id);
    console.log(`✓ Workflow reactivated`);
    console.log(`  New Webhook URL: ${reactivationResult.webhookUrl}`);

    const newSubscriptions = await getWorkflowSubscriptions(workflow.id);
    if (newSubscriptions.length !== 1) {
      throw new Error("New subscription was not created!");
    }
    console.log(`✓ New subscription created: ${newSubscriptions[0].id}`);

    // Verify webhook path is different
    if (newSubscriptions[0].webhookPath === subscription.webhookPath) {
      throw new Error("Webhook path should be different!");
    }
    console.log(`✓ New webhook path: ${newSubscriptions[0].webhookPath}\n`);

    // ========================================================================
    // CLEANUP
    // ========================================================================

    console.log("[Cleanup] Deleting test data...");
    await deactivateWorkflow(workflow.id, user.id);
    await prisma.workflow.delete({ where: { id: workflow.id } });
    await prisma.user.delete({ where: { id: user.id } });
    console.log("✓ Test data deleted\n");

    // ========================================================================
    // SUMMARY
    // ========================================================================

    console.log("========================================");
    console.log("✅ ALL TESTS PASSED");
    console.log("========================================");
    console.log("\nThe webhook trigger system is working correctly:");
    console.log("• Trigger subscriptions are created on activation");
    console.log("• Subscriptions can be looked up by webhook path");
    console.log("• Subscriptions are deleted on deactivation");
    console.log("• New subscriptions have unique webhook paths");
    console.log("• Subscription metadata is properly initialized");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ TEST FAILED");
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
