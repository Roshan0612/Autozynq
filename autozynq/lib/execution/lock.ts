/**
 * Execution Locking & Concurrency Safety Layer
 * 
 * Ensures only one RUNNING execution per workflow through atomic locking.
 * 
 * Design:
 * - ExecutionLock model with workflowId unique constraint
 * - Lock acquired before execution starts
 * - Lock released on terminal states (SUCCESS, FAILED, ABORTED)
 * - TTL (expiresAt) allows recovery from crashed executions
 * - All operations are atomic and database-enforced
 */

import { prisma } from "../prisma";

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * Thrown when lock cannot be acquired because workflow is already executing.
 * This is NOT a system error - it's a concurrency control response.
 */
export class WorkflowLockedError extends Error {
  constructor(
    public workflowId: string,
    public existingExecutionId: string,
    message?: string
  ) {
    super(
      message ||
      `Workflow ${workflowId} is currently locked by execution ${existingExecutionId}. ` +
      `Only one execution can run at a time per workflow.`
    );
    this.name = "WorkflowLockedError";
  }
}

/**
 * Thrown when a lock exists for a workflow but execution is not in RUNNING state.
 * This indicates a stale/orphaned lock that should be cleaned up.
 */
export class StaleExecutionLockError extends Error {
  constructor(
    public workflowId: string,
    public lockId: string,
    public executionStatus: string
  ) {
    super(
      `Stale execution lock detected for workflow ${workflowId}. ` +
      `Lock exists for execution with status ${executionStatus}. ` +
      `Lock ID: ${lockId}`
    );
    this.name = "StaleExecutionLockError";
  }
}

/**
 * Thrown when lock cannot be acquired due to database constraint violation.
 * Indicates another concurrent request succeeded in acquiring the lock.
 */
export class LockAcquisitionFailedError extends Error {
  constructor(public workflowId: string, public reason: string) {
    super(
      `Failed to acquire execution lock for workflow ${workflowId}: ${reason}`
    );
    this.name = "LockAcquisitionFailedError";
  }
}

// ============================================================================
// LOCK ACQUISITION
// ============================================================================

export interface LockAcquisitionResult {
  lockId: string;
  workflowId: string;
  executionId: string;
  acquiredAt: Date;
}

/**
 * Attempt to acquire an execution lock for a workflow.
 * 
 * Algorithm:
 * 1. Check if lock exists
 * 2. If exists and execution is RUNNING → throw WorkflowLockedError
 * 3. If exists and execution is NOT RUNNING → clean stale lock
 * 4. Create new lock atomically
 * 
 * Database constraints ensure atomicity:
 * - workflowId is unique on ExecutionLock
 * - Constraint violations indicate concurrent lock acquisition
 * 
 * @param workflowId - Workflow to lock
 * @param executionId - Execution record ID
 * @returns Lock result if successful
 * @throws WorkflowLockedError if workflow currently executing
 * @throws StaleExecutionLockError if stale lock detected
 * @throws LockAcquisitionFailedError if constraint violation
 */
export async function acquireExecutionLock(
  workflowId: string,
  executionId: string
): Promise<LockAcquisitionResult> {
  // ============================================================================
  // STEP 1: Check for existing lock
  // ============================================================================

  const existingLock = await prisma.executionLock.findUnique({
    where: { workflowId },
  });

  if (existingLock) {
    console.log(
      `[Lock] Existing lock found for workflow ${workflowId} (execution: ${existingLock.executionId})`
    );

    // ============================================================================
    // STEP 2: Check if lock is stale (execution not RUNNING)
    // ============================================================================

    const execution = await prisma.execution.findUnique({
      where: { id: existingLock.executionId },
      select: { status: true },
    });

    if (execution?.status === "RUNNING") {
      // Lock is active - workflow is currently executing
      console.log(
        `[Lock] Workflow ${workflowId} is currently executing (execution: ${existingLock.executionId}). Rejecting concurrent execution.`
      );

      throw new WorkflowLockedError(
        workflowId,
        existingLock.executionId,
        `Workflow is currently executing. Existing execution: ${existingLock.executionId}`
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (execution && (execution.status as any) !== "RUNNING") {
      // Stale lock - execution finished but lock wasn't cleaned up
      console.warn(
        `[Lock] Stale lock detected for workflow ${workflowId}. Execution ${existingLock.executionId} has status ${execution.status}. Cleaning up.`
      );

      // Clean up stale lock
      await prisma.executionLock.delete({
        where: { id: existingLock.id },
      });

      console.log(
        `[Lock] Stale lock removed. Proceeding with new lock acquisition.`
      );
    } else if (!execution) {
      // Execution record missing (orphaned lock)
      console.warn(
        `[Lock] Orphaned lock detected for workflow ${workflowId}. Execution record ${existingLock.executionId} not found. Cleaning up.`
      );

      await prisma.executionLock.delete({
        where: { id: existingLock.id },
      });

      console.log(
        `[Lock] Orphaned lock removed. Proceeding with new lock acquisition.`
      );
    }
  }

  // ============================================================================
  // STEP 3: Attempt to acquire new lock atomically
  // ============================================================================

  try {
    const newLock = await prisma.executionLock.create({
      data: {
        workflowId,
        executionId,
        lockedAt: new Date(),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour TTL
      },
    });

    console.log(
      `[Lock] Successfully acquired lock for workflow ${workflowId} (execution: ${executionId})`
    );

    return {
      lockId: newLock.id,
      workflowId: newLock.workflowId,
      executionId: newLock.executionId,
      acquiredAt: newLock.lockedAt,
    };
  } catch (error: unknown) {
    const err = error as Record<string, unknown>;
    // Check if error is due to unique constraint violation
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (err.code === "P2002" && ((err.meta as any)?.target as string[])?.includes?.("workflowId")) {
      console.error(
        `[Lock] Lock acquisition failed due to constraint violation. Another concurrent request acquired the lock.`
      );

      throw new LockAcquisitionFailedError(
        workflowId,
        "Concurrent lock acquisition detected. Another request succeeded."
      );
    }

    // Other error, rethrow
    throw error;
  }
}

// ============================================================================
// LOCK RELEASE
// ============================================================================

export interface LockReleaseResult {
  workflowId: string;
  wasLocked: boolean;
  lockDuration: number; // milliseconds
}

/**
 * Release an execution lock for a workflow.
 * 
 * Called on terminal execution states:
 * - SUCCESS
 * - FAILED
 * - ABORTED
 * 
 * Behavior:
 * - If lock exists for this execution → delete it
 * - If lock exists but for different execution → leave it (shouldn't happen)
 * - If no lock exists → do nothing (already cleaned, stale TTL, etc.)
 * 
 * @param workflowId - Workflow to unlock
 * @param executionId - Execution that held the lock
 * @returns Release result with duration
 */
export async function releaseExecutionLock(
  workflowId: string,
  executionId: string
): Promise<LockReleaseResult> {
  const existingLock = await prisma.executionLock.findUnique({
    where: { workflowId },
  });

  if (!existingLock) {
    console.log(
      `[Lock] No lock found for workflow ${workflowId}. Lock may have already been released or cleaned.`
    );

    return {
      workflowId,
      wasLocked: false,
      lockDuration: 0,
    };
  }

  // Verify this lock was for the correct execution
  if (existingLock.executionId !== executionId) {
    console.warn(
      `[Lock] Lock exists for workflow ${workflowId} but belongs to different execution. ` +
      `Lock: ${existingLock.executionId}, Current: ${executionId}. ` +
      `This shouldn't happen - leaving lock intact.`
    );

    return {
      workflowId,
      wasLocked: false,
      lockDuration: 0,
    };
  }

  // Delete the lock
  const duration = Date.now() - existingLock.lockedAt.getTime();

  await prisma.executionLock.delete({
    where: { id: existingLock.id },
  });

  console.log(
    `[Lock] Released lock for workflow ${workflowId} (execution: ${executionId}). Duration: ${duration}ms`
  );

  return {
    workflowId,
    wasLocked: true,
    lockDuration: duration,
  };
}

// ============================================================================
// LOCK STATUS CHECK
// ============================================================================

export interface LockStatusResult {
  workflowId: string;
  isLocked: boolean;
  executionId?: string;
  lockedSince?: Date;
  expiresAt?: Date;
  isStale?: boolean;
}

/**
 * Check if a workflow has an active lock.
 * 
 * Checks both:
 * - Lock existence
 * - Associated execution status
 * - Lock TTL expiration
 * 
 * @param workflowId - Workflow to check
 * @returns Lock status
 */
export async function getExecutionLockStatus(
  workflowId: string
): Promise<LockStatusResult> {
  const lock = await prisma.executionLock.findUnique({
    where: { workflowId },
  });

  if (!lock) {
    return {
      workflowId,
      isLocked: false,
    };
  }

  // Check if lock is expired
  const isExpired = new Date() > lock.expiresAt;

  if (isExpired) {
    return {
      workflowId,
      isLocked: false,
      executionId: lock.executionId,
      lockedSince: lock.lockedAt,
      expiresAt: lock.expiresAt,
      isStale: true,
    };
  }

  // Check execution status
  const execution = await prisma.execution.findUnique({
    where: { id: lock.executionId },
    select: { status: true },
  });

  const isActuallyLocked = execution?.status === "RUNNING";

  return {
    workflowId,
    isLocked: isActuallyLocked,
    executionId: lock.executionId,
    lockedSince: lock.lockedAt,
    expiresAt: lock.expiresAt,
    isStale: !isActuallyLocked,
  };
}

// ============================================================================
// CLEANUP UTILITIES
// ============================================================================

/**
 * Clean up expired locks.
 * 
 * Should be run periodically as a background job.
 * Removes locks where expiresAt < now.
 * 
 * @returns Count of locks removed
 */
export async function cleanupExpiredLocks(): Promise<number> {
  const result = await prisma.executionLock.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  });

  if (result.count > 0) {
    console.log(`[Lock] Cleaned up ${result.count} expired locks`);
  }

  return result.count;
}

/**
 * Force release a lock (admin/recovery use only).
 * 
 * Used when a lock is known to be stale/orphaned.
 * 
 * @param workflowId - Workflow to force unlock
 * @returns Whether a lock was removed
 */
export async function forceReleaseLock(workflowId: string): Promise<boolean> {
  const lock = await prisma.executionLock.findUnique({
    where: { workflowId },
  });

  if (!lock) {
    console.log(`[Lock] No lock to force release for workflow ${workflowId}`);
    return false;
  }

  await prisma.executionLock.delete({
    where: { id: lock.id },
  });

  console.warn(
    `[Lock] Force released lock for workflow ${workflowId} (was held by execution ${lock.executionId})`
  );

  return true;
}
