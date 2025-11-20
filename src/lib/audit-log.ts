import { prisma } from '@/lib/prisma';
import { currentUser } from '@clerk/nextjs/server';
import { Prisma } from '@prisma/client';

export enum AuditAction {
  // Bulk Upload Actions
  BULK_UPLOAD_APPLIED = 'BULK_UPLOAD_APPLIED',
  BULK_UPLOAD_SIMULATED = 'BULK_UPLOAD_SIMULATED',
  BULK_UPLOAD_FAILED = 'BULK_UPLOAD_FAILED',
  BULK_UPLOAD_ROLLED_BACK = 'BULK_UPLOAD_ROLLED_BACK',
  
  // Community Submission Actions
  COMMUNITY_SUBMISSION_CREATED = 'COMMUNITY_SUBMISSION_CREATED',
  COMMUNITY_SUBMISSION_APPROVED = 'COMMUNITY_SUBMISSION_APPROVED',
  COMMUNITY_SUBMISSION_REJECTED = 'COMMUNITY_SUBMISSION_REJECTED',
  
  // User Management Actions
  USER_ROLE_CHANGED = 'USER_ROLE_CHANGED',
  USER_CREATED = 'USER_CREATED',
  
  // Person Actions
  PERSON_MANUALLY_EDITED = 'PERSON_MANUALLY_EDITED',
  PERSON_MANUALLY_DELETED = 'PERSON_MANUALLY_DELETED',
  
  // System Actions
  SYSTEM_CONFIG_CHANGED = 'SYSTEM_CONFIG_CHANGED',
  DATABASE_CLEARED = 'DATABASE_CLEARED',
}

export enum ResourceType {
  BULK_UPLOAD = 'BULK_UPLOAD',
  COMMUNITY_SUBMISSION = 'COMMUNITY_SUBMISSION',
  PERSON = 'PERSON',
  USER = 'USER',
  SYSTEM = 'SYSTEM',
}

interface CreateAuditLogParams {
  action: AuditAction | string;
  resourceType: ResourceType | string;
  resourceId?: string;
  description: string;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string;
}

/**
 * Create an audit log entry
 * Automatically captures current user from Clerk
 */
export async function createAuditLog(params: CreateAuditLogParams) {
  try {
    const user = await currentUser();
    
    if (!user) {
      console.warn('Audit log created without user context');
      return null;
    }

    const auditLog = await prisma.auditLog.create({
      data: {
        userId: user.id,
        userEmail: user.emailAddresses[0]?.emailAddress || null,
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId,
        description: params.description,
        metadata: params.metadata ?? Prisma.JsonNull,
        ipAddress: params.ipAddress,
      },
    });

    return auditLog;
  } catch (error) {
    // Don't let audit logging failure break the main operation
    console.error('Failed to create audit log:', error);
    return null;
  }
}

/**
 * Create audit log without requiring current user context
 * Use this for system-level actions or when user is passed explicitly
 */
export async function createAuditLogWithUser(
  userId: string,
  userEmail: string | null,
  params: CreateAuditLogParams
) {
  try {
    const auditLog = await prisma.auditLog.create({
      data: {
        userId,
        userEmail,
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId,
        description: params.description,
        metadata: params.metadata ?? Prisma.JsonNull,
        ipAddress: params.ipAddress,
      },
    });

    return auditLog;
  } catch (error) {
    console.error('Failed to create audit log:', error);
    return null;
  }
}

/**
 * Get recent audit logs
 */
export async function getRecentAuditLogs(limit: number = 50) {
  return prisma.auditLog.findMany({
    take: limit,
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get audit logs for a specific resource
 */
export async function getResourceAuditLogs(resourceType: string, resourceId: string) {
  return prisma.auditLog.findMany({
    where: {
      resourceType,
      resourceId,
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get audit logs for a specific user
 */
export async function getUserAuditLogs(userId: string, limit: number = 50) {
  return prisma.auditLog.findMany({
    where: { userId },
    take: limit,
    orderBy: { createdAt: 'desc' },
  });
}

