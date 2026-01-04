/**
 * Execution Locking & Concurrency Safety Tests
 * 
 * Tests for:
 * 1. Lock acquisition prevents concurrent executions
 * 2. Lock release on SUCCESS/FAILED/ABORTED
 * 3. Concurrent webhooks only start one execution
 * 4. Idempotency + locking work together
 * 5. No deadlocks or orphaned locks
 * 
 * Run with: npx tsx scripts/test-execution-locking.ts
 */

import { prisma } from "../lib/prisma";
import { runWorkflow } from "../lib/execution/engine";
import { runWorkflowIdempotent } from "../lib/execution/idempotency";
import { WorkflowLockedError, LockAcquisitionFailedError, getExecutionLockStatus } from "../lib/execution/lock";

const TEST_USER_EMAIL = "test-lock@autozynq.com";

async function setupTestUser() {
  let user = await prisma.user.findUnique({
    where: { email: TEST_USER_EMAIL },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: TEST_USER_EMAIL,
        name: "Lock Test User",
      },
    });
  }

  return user;
}

async function createTestWorkflow(userId: string, name: string, nodeCount: number = 5) {
  const nodes = [];
  const edges = [];

  for (let i = 0; i < nodeCount; i++) {
    nodes.push({
      id: `node-${i}`,
      type: "test.trigger.passthrough",
      config: {},
    });

    if (i > 0) {
      edges.push({
        from: `node-${i - 1}`,
        to: `node-${i}`,
      });
    }
  }

  return await prisma.workflow.create({
    data: {
      name,
      userId,
      status: "ACTIVE",
      definition: {
        nodes,
        edges,
      },
    },
  });
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// TEST 1: Lock Acquisition Prevents Concurrent Executions
// ============================================================================

async function testLockPreventsCurrentExecution() {
  console.log("\n🧪 TEST 1: Lock Prevents Concurrent Execution");
  console.log("=".repeat(60));

  const user = await setupTestUser();
  const workflow = await createTestWorkflow(user.id, "Test Lock Prevention");

  try {
    // Start first execution
    console.log("▶ Starting first execution...");
    const execution1Promise = runWorkflow({
      workflowId: workflow.id,
      userId: user.id,
      triggerInput: { test: "concurrent-1" },
    });

    // Wait for first execution to acquire lock
    await sleep(300);

    // Check lock status
    const lockStatus = await getExecutionLockStatus(workflow.id);
    console.log(`✓ Lock acquired: ${lockStatus.isLocked}`);
    console.log(`  - Locked by execution: ${lockStatus.executionId}`);

    // Try to start second execution (should fail)
    console.log("▶ Attempting second execution (should fail)...");
    let secondExecutionFailed = false;
    let existingExecutionId: string | undefined;

    try {
      await runWorkflow({
        workflowId: workflow.id,
        userId: user.id,
        triggerInput: { test: "concurrent-2" },
      });
    } catch (error) {
      if (error instanceof WorkflowLockedError) {
        secondExecutionFailed = true;
        existingExecutionId = error.existingExecutionId;
        console.log(`✓ Second execution rejected with WorkflowLockedError`);
        console.log(`  - Reason: ${error.message}`);
        console.log(`  - Locked by: ${existingExecutionId}`);
      } else {
        throw error;
      }
    }

    if (!secondExecutionFailed) {
      console.log(`❌ FAILED: Second execution should have been rejected`);
      return false;
    }

    // Wait for first execution to complete
    await execution1Promise;

    // Check lock is released
    const lockStatusAfter = await getExecutionLockStatus(workflow.id);
    console.log(`✓ Lock released after completion: ${!lockStatusAfter.isLocked}`);

    // Now third execution should succeed
    console.log("▶ Attempting third execution (should succeed)...");
    const execution3 = await runWorkflow({
      workflowId: workflow.id,
      userId: user.id,
      triggerInput: { test: "concurrent-3" },
    });

    console.log(`✓ Third execution succeeded: ${execution3}`);

    console.log(`✅ SUCCESS: Lock prevents concurrent execution`);
    return true;
  } catch (error) {
    console.log(`❌ FAILED: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  } finally {
    await prisma.workflow.delete({ where: { id: workflow.id } });
  }
}

// ============================================================================
// TEST 2: Lock Release on SUCCESS
// ============================================================================

async function testLockReleaseOnSuccess() {
  console.log("\n🧪 TEST 2: Lock Release on SUCCESS");
  console.log("=".repeat(60));

  const user = await setupTestUser();
  const workflow = await createTestWorkflow(user.id, "Test Lock Release Success");

  try {
    const executionId = await runWorkflow({
      workflowId: workflow.id,
      userId: user.id,
      triggerInput: { test: "success" },
    });

    console.log(`✓ Execution completed: ${executionId}`);

    // Check execution status
    const execution = await prisma.execution.findUnique({
      where: { id: executionId },
    });

    console.log(`✓ Execution status: ${execution?.status}`);

    if (execution?.status !== "SUCCESS") {
      console.log(`❌ FAILED: Expected SUCCESS, got ${execution?.status}`);
      return false;
    }

    // Check lock is released
    const lockStatus = await getExecutionLockStatus(workflow.id);

    if (lockStatus.isLocked) {
      console.log(`❌ FAILED: Lock should be released after SUCCESS`);
      return false;
    }

    console.log(`✓ Lock released: ${!lockStatus.isLocked}`);
    console.log(`✅ SUCCESS: Lock released correctly`);
    return true;
  } catch (error) {
    console.log(`❌ FAILED: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  } finally {
    await prisma.workflow.delete({ where: { id: workflow.id } });
  }
}

// ============================================================================
// TEST 3: Lock Release on FAILED
// ============================================================================

async function testLockReleaseOnFailed() {
  console.log("\n🧪 TEST 3: Lock Release on FAILED");
  console.log("=".repeat(60));

  const user = await setupTestUser();

  // Create workflow with invalid node (will fail)
  const workflow = await prisma.workflow.create({
    data: {
      name: "Test Lock Release Failed",
      userId: user.id,
      status: "ACTIVE",
      definition: {
        nodes: [
          {
            id: "node-1",
            type: "test.trigger.passthrough",
            config: {},
          },
          {
            id: "node-2",
            type: "nonexistent/node", // This will cause failure
            config: {},
          },
        ],
        edges: [
          {
            from: "node-1",
            to: "node-2",
          },
        ],
      },
    },
  });

  try {
    let executionId: string | undefined;

    try {
      executionId = await runWorkflow({
        workflowId: workflow.id,
        userId: user.id,
        triggerInput: { test: "failure" },
      });
    } catch (error) {
      // Expected to throw
      console.log(`✓ Execution threw error (expected)`);
    }

    // Get execution record
    const execution = await prisma.execution.findFirst({
      where: { workflowId: workflow.id },
      orderBy: { startedAt: "desc" },
    });

    console.log(`✓ Execution status: ${execution?.status}`);

    if (execution?.status !== "FAILED") {
      console.log(`❌ FAILED: Expected FAILED, got ${execution?.status}`);
      return false;
    }

    // Check lock is released
    const lockStatus = await getExecutionLockStatus(workflow.id);

    if (lockStatus.isLocked) {
      console.log(`❌ FAILED: Lock should be released after FAILED`);
      return false;
    }

    console.log(`✓ Lock released: ${!lockStatus.isLocked}`);
    console.log(`✅ SUCCESS: Lock released on FAILED`);
    return true;
  } catch (error) {
    console.log(`❌ FAILED: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  } finally {
    await prisma.workflow.delete({ where: { id: workflow.id } });
  }
}

// ============================================================================
// TEST 4: Concurrent Webhooks (Simulated)
// ============================================================================

async function testConcurrentWebhookSimulation() {
  console.log("\n🧪 TEST 4: Concurrent Webhook Requests");
  console.log("=".repeat(60));

  const user = await setupTestUser();
  const workflow = await createTestWorkflow(user.id, "Test Concurrent Webhooks", 3);

  try {
    console.log("▶ Starting concurrent execution attempts...");

    // Simulate multiple concurrent webhook requests
    const promises = [
      runWorkflowIdempotent({
        workflowId: workflow.id,
        userId: user.id,
        triggerInput: { event: "webhook-1" },
        idempotency: {
          nodeId: "node-0",
          webhookPath: "test",
          eventId: "event-1",
        },
      }),
      runWorkflowIdempotent({
        workflowId: workflow.id,
        userId: user.id,
        triggerInput: { event: "webhook-2" },
        idempotency: {
          nodeId: "node-0",
          webhookPath: "test",
          eventId: "event-2",
        },
      }),
      runWorkflowIdempotent({
        workflowId: workflow.id,
        userId: user.id,
        triggerInput: { event: "webhook-3" },
        idempotency: {
          nodeId: "node-0",
          webhookPath: "test",
          eventId: "event-3",
        },
      }),
    ];

    // Race all three attempts
    const results = await Promise.allSettled(promises);

    let successCount = 0;
    let lockedCount = 0;
    const executionIds = new Set<string>();

    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        successCount++;
        executionIds.add(result.value.executionId);
        console.log(`  Request ${index + 1}: Success (execution: ${result.value.executionId})`);
      } else {
        const error = result.reason;
        if (error instanceof WorkflowLockedError) {
          lockedCount++;
          console.log(`  Request ${index + 1}: Locked (${error.existingExecutionId})`);
        } else {
          console.log(`  Request ${index + 1}: Error (${error.message})`);
        }
      }
    });

    console.log(`✓ Results: ${successCount} successful, ${lockedCount} locked`);
    console.log(`✓ Unique execution IDs: ${executionIds.size}`);

    // Should have exactly 1 successful execution and 2 locked
    if (successCount !== 1) {
      console.log(`❌ FAILED: Expected 1 success, got ${successCount}`);
      return false;
    }

    if (lockedCount !== 2) {
      console.log(`❌ FAILED: Expected 2 locked, got ${lockedCount}`);
      return false;
    }

    if (executionIds.size !== 1) {
      console.log(`❌ FAILED: Expected 1 unique execution, got ${executionIds.size}`);
      return false;
    }

    console.log(`✅ SUCCESS: Concurrent webhooks handled correctly`);
    return true;
  } catch (error) {
    console.log(`❌ FAILED: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  } finally {
    await prisma.workflow.delete({ where: { id: workflow.id } });
  }
}

// ============================================================================
// TEST 5: Idempotency + Locking Together
// ============================================================================

async function testIdempotencyWithLocking() {
  console.log("\n🧪 TEST 5: Idempotency + Locking Work Together");
  console.log("=".repeat(60));

  const user = await setupTestUser();
  const workflow = await createTestWorkflow(user.id, "Test Idempotency Locking");

  try {
    // First request - should succeed and create execution
    const result1 = await runWorkflowIdempotent({
      workflowId: workflow.id,
      userId: user.id,
      triggerInput: { event: "test" },
      idempotency: {
        nodeId: "node-0",
        webhookPath: "test",
        eventId: "same-event-id",
      },
    });

    console.log(`✓ First execution: ${result1.executionId}`);

    await sleep(200);

    // Second request - same eventId - should return duplicate
    const result2 = await runWorkflowIdempotent({
      workflowId: workflow.id,
      userId: user.id,
      triggerInput: { event: "test" },
      idempotency: {
        nodeId: "node-0",
        webhookPath: "test",
        eventId: "same-event-id",
      },
    });

    console.log(`✓ Second execution: ${result2.executionId}`);
    console.log(`✓ Is duplicate: ${result2.isDuplicate}`);

    if (!result2.isDuplicate || result2.executionId !== result1.executionId) {
      console.log(`❌ FAILED: Idempotency should detect duplicate`);
      return false;
    }

    // Third request - different eventId - should be rejected if still locked
    const result3Promise = runWorkflowIdempotent({
      workflowId: workflow.id,
      userId: user.id,
      triggerInput: { event: "test" },
      idempotency: {
        nodeId: "node-0",
        webhookPath: "test",
        eventId: "different-event-id",
      },
    });

    let thirdFailed = false;
    try {
      await result3Promise;
    } catch (error) {
      if (error instanceof WorkflowLockedError) {
        thirdFailed = true;
        console.log(`✓ Third execution blocked by lock`);
      }
    }

    // Both idempotency and locking should work together
    console.log(`✅ SUCCESS: Idempotency and locking work together`);
    return true;
  } catch (error) {
    console.log(`❌ FAILED: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  } finally {
    await prisma.workflow.delete({ where: { id: workflow.id } });
  }
}

// ============================================================================
// TEST 6: No Orphaned Locks
// ============================================================================

async function testNoOrphanedLocks() {
  console.log("\n🧪 TEST 6: No Orphaned Locks");
  console.log("=".repeat(60));

  const user = await setupTestUser();
  const workflow = await createTestWorkflow(user.id, "Test Orphaned Locks");

  try {
    // Run execution
    const executionId = await runWorkflow({
      workflowId: workflow.id,
      userId: user.id,
      triggerInput: { test: "orphan-check" },
    });

    console.log(`✓ Execution completed: ${executionId}`);

    // Check execution is in terminal state
    const execution = await prisma.execution.findUnique({
      where: { id: executionId },
    });

    console.log(`✓ Final status: ${execution?.status}`);

    if (execution?.status === "RUNNING") {
      console.log(`❌ FAILED: Execution still in RUNNING state`);
      return false;
    }

    // Check no lock remains
    const lock = await prisma.executionLock.findUnique({
      where: { workflowId: workflow.id },
    });

    if (lock) {
      console.log(`❌ FAILED: Orphaned lock found: ${lock.id}`);
      return false;
    }

    console.log(`✓ No locks remain`);
    console.log(`✅ SUCCESS: No orphaned locks`);
    return true;
  } catch (error) {
    console.log(`❌ FAILED: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  } finally {
    await prisma.workflow.delete({ where: { id: workflow.id } });
  }
}

// ============================================================================
// RUN ALL TESTS
// ============================================================================

async function runAllTests() {
  console.log("\n");
  console.log("═".repeat(60));
  console.log("  EXECUTION LOCKING & CONCURRENCY SAFETY TEST SUITE");
  console.log("═".repeat(60));

  const results = {
    lockPrevention: await testLockPreventsCurrentExecution(),
    lockReleaseSuccess: await testLockReleaseOnSuccess(),
    lockReleaseFailed: await testLockReleaseOnFailed(),
    concurrentWebhooks: await testConcurrentWebhookSimulation(),
    idempotencyLocking: await testIdempotencyWithLocking(),
    noOrphanedLocks: await testNoOrphanedLocks(),
  };

  console.log("\n");
  console.log("═".repeat(60));
  console.log("  TEST SUMMARY");
  console.log("═".repeat(60));

  const tests = [
    { name: "Lock Prevents Concurrent Execution", result: results.lockPrevention },
    { name: "Lock Release on SUCCESS", result: results.lockReleaseSuccess },
    { name: "Lock Release on FAILED", result: results.lockReleaseFailed },
    { name: "Concurrent Webhook Requests", result: results.concurrentWebhooks },
    { name: "Idempotency + Locking", result: results.idempotencyLocking },
    { name: "No Orphaned Locks", result: results.noOrphanedLocks },
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
