/**
 * Connection Service
 * 
 * Manages OAuth connections for external service integrations.
 * Handles CRUD operations, token refresh, and connection validation.
 */

import { prisma } from "@/lib/prisma";
import type { Connection } from "@prisma/client";

export interface CreateConnectionInput {
  userId: string;
  provider: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface UpdateConnectionInput {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Create a new connection for a user
 */
export async function createConnection(
  input: CreateConnectionInput
): Promise<Connection> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {
    userId: input.userId,
    provider: input.provider,
    accessToken: input.accessToken,
    refreshToken: input.refreshToken,
    expiresAt: input.expiresAt,
  };
  if (input.metadata) {
    data.metadata = input.metadata;
  }
  return await prisma.connection.create({ data });
}

/**
 * Get a connection by ID
 */
export async function getConnection(
  connectionId: string
): Promise<Connection | null> {
  return await prisma.connection.findUnique({
    where: { id: connectionId },
  });
}

/**
 * Get user's connection for a specific provider
 */
export async function getUserConnection(
  userId: string,
  provider: string
): Promise<Connection | null> {
  return await prisma.connection.findFirst({
    where: {
      userId,
      provider,
    },
  });
}

/**
 * List all connections for a user
 */
export async function listUserConnections(
  userId: string
): Promise<Connection[]> {
  return await prisma.connection.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Update an existing connection (e.g., refresh tokens)
 */
export async function updateConnection(
  connectionId: string,
  input: UpdateConnectionInput
): Promise<Connection> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {
    updatedAt: new Date(),
  };
  if (input.accessToken) {
    data.accessToken = input.accessToken;
  }
  if (input.refreshToken !== undefined) {
    data.refreshToken = input.refreshToken;
  }
  if (input.expiresAt !== undefined) {
    data.expiresAt = input.expiresAt;
  }
  if (input.metadata !== undefined) {
    data.metadata = input.metadata;
  }
  return await prisma.connection.update({
    where: { id: connectionId },
    data,
  });
}

/**
 * Delete a connection
 */
export async function deleteConnection(connectionId: string): Promise<void> {
  await prisma.connection.delete({
    where: { id: connectionId },
  });
}

/**
 * Check if a connection's access token is expired
 */
export function isConnectionExpired(connection: Connection): boolean {
  if (!connection.expiresAt) return false;
  return new Date() >= connection.expiresAt;
}

/**
 * Validate that a connection exists and belongs to the user
 */
export async function validateConnection(
  connectionId: string,
  userId: string
): Promise<Connection> {
  const connection = await getConnection(connectionId);

  if (!connection) {
    throw new Error(`Connection not found: ${connectionId}`);
  }

  if (connection.userId !== userId) {
    throw new Error(
      `Connection ${connectionId} does not belong to user ${userId}`
    );
  }

  if (isConnectionExpired(connection)) {
    throw new Error(
      `Connection ${connectionId} has expired. Please reconnect.`
    );
  }

  return connection;
}
