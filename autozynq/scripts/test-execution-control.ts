/**
 * Execution Control Layer Tests
 * 
 * Tests for:
 * 1. Cancel execution (CANCEL_REQUESTED → ABORTED)
 * 2. Idempotency (duplicate prevention)
 * 3. FAILED vs ABORTED distinction
 * 4. Engine guard (stops execution on cancel)
 * 
 * Run with: npx tsx scripts/test-execution-control.ts
 */

import { prisma } from "../lib/prisma";
import { runWorkflow } from "../lib/execution/engine";
import { runWorkflowIdempotent } from "../lib/execution/idempotency";

const TEST_USER_EMAIL = "test@autozynq.com";

async function setupTestUser() {
  let user = await prisma.user.findUnique({
    where: { email: TEST_USER_EMAIL },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: TEST_USER_EMAIL,
        name: "Test User",
      },
    });
  }

  return user;
}

async function createTestWorkflow(userId: string, name: string) {
  return await prisma.workflow.create({
    data: {
      name,
      userId,
      status: "ACTIVE",
      definition: {
        nodes: [
          {
            id: "trigger-1",
            type: "test.trigger.passthrough",
            config: {},
          },
          {
            id: "action-1",
            type: "test.trigger.passthrough", // Using passthrough as simple action
            config: {},
          },
          {
            id: "action-2",
            type: "test.trigger.passthrough",
            config: {},
          },
          {
            id: "action-3",
            type: "test.trigger.passthrough",
            config: {},
          },
          {
            id: "action-4",
            type: "test.trigger.passthrough",
            config: {},
          },
        ],
        edges: [
          { from: "trigger-1", to: "action-1" },
          { from: "action-1", to: "action-2" },
          { from: "action-2", to: "action-3" },
          { from: "action-3", to: "action-4" },
        ],
      },
    },
  });
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// TEST 1: Cancel Execution
// ============================================================================

async function testCancelExecution() {
  console.log("\n🧪 TEST 1: Cancel Execution");
  console.log("=" .repeat(60));

  const user = await setupTestUser();
  const workflow = await createTestWorkflow(user.id, "Test Cancel Execution");

  try {
    // Start execution in background (don't await)
    const executionPromise = runWorkflow({
      workflowId: workflow.id,
      userId: user.id,
      triggerInput: { test: "cancel-me" },
    });

    // Wait longer for execution to start and get into RUNNING state
    await sleep(500);

    // Find the running execution
    const execution = await prisma.execution.findFirst({
      where: {
        workflowId: workflow.id,
        status: "RUNNING",
      },
      orderBy: { startedAt: "desc" },
    });

    if (!execution) {
      throw new Error("No running execution found");
    }

    console.log(`✓ Execution started: ${execution.id}`);

    // Cancel the execution
    await prisma.execution.update({
      where: { id: execution.id },
      data: {
        status: "CANCEL_REQUESTED",
        abortedAt: new Date(),
        abortedBy: user.id,
        abortReason: "Test cancellation",
      },
    });

    console.log(`✓ Marked execution as CANCEL_REQUESTED`);

    // Wait for execution to finish (it should abort)
    await executionPromise;

    // Check final status
    const finalExecution = await prisma.execution.findUnique({
      where: { id: execution.id },
    });

    if (finalExecution?.status === "ABORTED") {
      console.log(`✅ SUCCESS: Execution was aborted correctly`);
      console.log(`   - Aborted at: ${finalExecution.abortedAt}`);
      console.log(`   - Aborted by: ${finalExecution.abortedBy}`);
      console.log(`   - Reason: ${finalExecution.abortReason}`);
      return true;
    } else {
      console.log(
        `❌ FAILED: Execution status is ${finalExecution?.status}, expected ABORTED`
      );
      return false;
    }
  } catch (error) {
    console.log(`❌ FAILED: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  } finally {
    // Cleanup
    await prisma.workflow.delete({ where: { id: workflow.id } });
  }
}

// ============================================================================
// TEST 2: Idempotency - Duplicate Prevention
// ============================================================================

async function testIdempotency() {
  console.log("\n🧪 TEST 2: Idempotency - Duplicate Prevention");
  console.log("=" .repeat(60));

  const user = await setupTestUser();
  const workflow = await createTestWorkflow(user.id, "Test Idempotency");

  try {
    const payload = { eventId: "evt_test_123", data: "test" };

    // First execution
    const result1 = await runWorkflowIdempotent({
      workflowId: workflow.id,
      userId: user.id,
      triggerInput: payload,
      idempotency: {
        nodeId: "trigger-1",
        webhookPath: "test-webhook",
        eventId: "evt_test_123",
      },
    });

    console.log(`✓ First execution: ${result1.executionId}`);
    console.log(`   - Is duplicate: ${result1.isDuplicate}`);
    console.log(`   - Idempotency key: ${result1.idempotencyKey}`);

    if (result1.isDuplicate) {
      console.log(`❌ FAILED: First execution should not be a duplicate`);
      return false;
    }

    // Second execution with same idempotency key
    const result2 = await runWorkflowIdempotent({
      workflowId: workflow.id,
      userId: user.id,
      triggerInput: payload,
      idempotency: {
        nodeId: "trigger-1",
        webhookPath: "test-webhook",
        eventId: "evt_test_123",
      },
    });

    console.log(`✓ Second execution: ${result2.executionId}`);
    console.log(`   - Is duplicate: ${result2.isDuplicate}`);
    console.log(`   - Idempotency key: ${result2.idempotencyKey}`);

    if (
      result2.isDuplicate &&
      result2.executionId === result1.executionId &&
      result2.idempotencyKey === result1.idempotencyKey
    ) {
      console.log(`✅ SUCCESS: Duplicate detected and existing execution returned`);
      return true;
    } else {
      console.log(`❌ FAILED: Expected duplicate detection`);
      console.log(`   - Expected execution ID: ${result1.executionId}`);
      console.log(`   - Got execution ID: ${result2.executionId}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ FAILED: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  } finally {
    // Cleanup
    await prisma.workflow.delete({ where: { id: workflow.id } });
  }
}

// ============================================================================
// TEST 3: FAILED vs ABORTED Distinction
// ============================================================================

async function testFailedVsAborted() {
  console.log("\n🧪 TEST 3: FAILED vs ABORTED Distinction");
  console.log("=" .repeat(60));

  const user = await setupTestUser();

  // Create workflow with invalid node (will fail)
  const failWorkflow = await prisma.workflow.create({
    data: {
      name: "Test Failed Execution",
      userId: user.id,
      status: "ACTIVE",
      definition: {
        nodes: [
          {
            id: "trigger-1",
            type: "test.trigger.passthrough",
            config: {},
          },
          {
            id: "action-1",
            type: "nonexistent/node", // This will cause a failure
            config: {},
          },
        ],
        edges: [{ from: "trigger-1", to: "action-1" }],
      },
    },
  });

  // Create normal workflow for abort test
  const abortWorkflow = await createTestWorkflow(user.id, "Test Aborted Execution");

  try {
    // Test 3A: FAILED execution (node error)
    console.log("\nTest 3A: Node Error → FAILED");
    
    let failedExecutionId: string;
    try {
      failedExecutionId = await runWorkflow({
        workflowId: failWorkflow.id,
        userId: user.id,
        triggerInput: { test: "fail" },
      });
    } catch (error) {
      // Expected to throw
      console.log(`✓ Execution threw error (expected)`);
    }

    const failedExecution = await prisma.execution.findFirst({
      where: { workflowId: failWorkflow.id },
      orderBy: { startedAt: "desc" },
    });

    if (failedExecution?.status === "FAILED" && failedExecution.error) {
      console.log(`✅ SUCCESS: Execution marked as FAILED with error`);
      console.log(`   - Error: ${JSON.stringify(failedExecution.error).substring(0, 100)}...`);
    } else {
      console.log(`❌ FAILED: Expected FAILED status, got ${failedExecution?.status}`);
      return false;
    }

    // Test 3B: ABORTED execution (user cancel)
    console.log("\nTest 3B: User Cancel → ABORTED");

    const abortExecutionPromise = runWorkflow({
      workflowId: abortWorkflow.id,
      userId: user.id,
      triggerInput: { test: "abort" },
    });

    await sleep(500);

    const runningExecution = await prisma.execution.findFirst({
      where: {
        workflowId: abortWorkflow.id,
        status: "RUNNING",
      },
      orderBy: { startedAt: "desc" },
    });

    if (!runningExecution) {
      console.log(`❌ FAILED: No running execution found`);
      return false;
    }

    await prisma.execution.update({
      where: { id: runningExecution.id },
      data: {
        status: "CANCEL_REQUESTED",
        abortedAt: new Date(),
        abortedBy: user.id,
        abortReason: "Test abort",
      },
    });

    await abortExecutionPromise;

    const abortedExecution = await prisma.execution.findUnique({
      where: { id: runningExecution.id },
    });

    if (abortedExecution?.status === "ABORTED" && !abortedExecution.error) {
      console.log(`✅ SUCCESS: Execution marked as ABORTED without error`);
      console.log(`   - Aborted: ${abortedExecution.abortedAt}`);
    } else {
      console.log(`❌ FAILED: Expected ABORTED status, got ${abortedExecution?.status}`);
      return false;
    }

    return true;
  } catch (error) {
    console.log(`❌ FAILED: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  } finally {
    // Cleanup
    await prisma.workflow.deleteMany({
      where: {
        id: { in: [failWorkflow.id, abortWorkflow.id] },
      },
    });
  }
}

// ============================================================================
// TEST 4: Idempotency with Payload Hash
// ============================================================================

async function testIdempotencyPayloadHash() {
  console.log("\n🧪 TEST 4: Idempotency with Payload Hash");
  console.log("=" .repeat(60));

  const user = await setupTestUser();
  const workflow = await createTestWorkflow(user.id, "Test Payload Hash");

  try {
    const payload = { data: "identical payload", timestamp: 123456 };

    // First execution (no eventId, should hash payload)
    const result1 = await runWorkflowIdempotent({
      workflowId: workflow.id,
      userId: user.id,
      triggerInput: payload,
      idempotency: {
        nodeId: "trigger-1",
        webhookPath: "test-webhook",
        // No eventId - will use payload hash
      },
    });

    console.log(`✓ First execution: ${result1.executionId}`);
    console.log(`   - Idempotency key: ${result1.idempotencyKey}`);

    // Second execution with identical payload
    const result2 = await runWorkflowIdempotent({
      workflowId: workflow.id,
      userId: user.id,
      triggerInput: payload,
      idempotency: {
        nodeId: "trigger-1",
        webhookPath: "test-webhook",
      },
    });

    console.log(`✓ Second execution (identical payload): ${result2.executionId}`);
    console.log(`   - Is duplicate: ${result2.isDuplicate}`);

    if (!result2.isDuplicate || result2.executionId !== result1.executionId) {
      console.log(`❌ FAILED: Expected duplicate detection with payload hash`);
      return false;
    }

    // Third execution with different payload
    const result3 = await runWorkflowIdempotent({
      workflowId: workflow.id,
      userId: user.id,
      triggerInput: { ...payload, timestamp: 789012 }, // Different!
      idempotency: {
        nodeId: "trigger-1",
        webhookPath: "test-webhook",
      },
    });

    console.log(`✓ Third execution (different payload): ${result3.executionId}`);
    console.log(`   - Is duplicate: ${result3.isDuplicate}`);

    if (result3.isDuplicate || result3.executionId === result1.executionId) {
      console.log(`❌ FAILED: Different payload should not be duplicate`);
      return false;
    }

    console.log(`✅ SUCCESS: Payload hash idempotency works correctly`);
    return true;
  } catch (error) {
    console.log(`❌ FAILED: ${error instanceof Error ? error.message : String(error)}`);
    // Log the full error for debugging
    if (error instanceof Error && error.stack) {
      console.log(`   Stack: ${error.stack.substring(0, 200)}...`);
    }
    return false;
  } finally {
    // Cleanup
    await prisma.workflow.delete({ where: { id: workflow.id } });
  }
}

// ============================================================================
// RUN ALL TESTS
// ============================================================================

async function runAllTests() {
  console.log("\n");
  console.log("═".repeat(60));
  console.log("  EXECUTION CONTROL LAYER TEST SUITE");
  console.log("═".repeat(60));

  const results = {
    cancelExecution: await testCancelExecution(),
    idempotency: await testIdempotency(),
    failedVsAborted: await testFailedVsAborted(),
    idempotencyPayloadHash: await testIdempotencyPayloadHash(),
  };

  console.log("\n");
  console.log("═".repeat(60));
  console.log("  TEST SUMMARY");
  console.log("═".repeat(60));

  const tests = [
    { name: "Cancel Execution", result: results.cancelExecution },
    { name: "Idempotency (Event ID)", result: results.idempotency },
    { name: "FAILED vs ABORTED", result: results.failedVsAborted },
    { name: "Idempotency (Payload Hash)", result: results.idempotencyPayloadHash },
  ];

  tests.forEach((test) => {
    console.log(`${test.result ? "✅" : "❌"} ${test.name}`);
  });

  const passed = Object.values(results).filter(Boolean).length;
  const total = Object.values(results).length;

  console.log("\n");
  console.log(`${passed}/${total} tests passed`);
  console.log("═".repeat(60));

  if (passed === total) {
    console.log("\n🎉 All tests passed!");
    process.exit(0);
  } else {
    console.log("\n❌ Some tests failed");
    process.exit(1);
  }
}

// Run tests
runAllTests().catch((error) => {
  console.error("Fatal error running tests:", error);
  process.exit(1);
});
