import { z } from 'zod';
export const joinSchema = z.object({
  storeInviteCode: z.string().trim().min(1).max(50),
  fullName: z.string().trim().min(1).max(255),
  phone: z.string().trim().max(20).optional(),
  desiredPosition: z.string().trim().max(100).optional(),
  note: z.string().trim().max(2000).optional(),
});
export const approveSchema = z.object({ role: z.enum(['staff', 'shift_leader', 'store_manager']), storeId: z.number().int().positive().optional() }).strict();
export const storeSchema = z.object({ name: z.string().trim().min(1).max(255), address: z.string().trim().max(2000).optional(), phone: z.string().trim().max(20).optional() });
export const listSchema = z.object({ status: z.enum(['pending', 'approved', 'rejected']).optional(), storeId: z.coerce.number().int().positive().optional(), page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20), search: z.string().trim().max(100).optional() });
export const canonicalWorkspaceSelectionSchema = z.object({
  membershipId: z.coerce.number().int().positive(),
  tenantId: z.coerce.number().int().positive(),
  storeId: z.coerce.number().int().positive().optional(),
}).strict();

export const canonicalTenantCreateSchema = z.object({ name: z.string().trim().min(2).max(255), address: z.string().trim().max(2000).optional(), phone: z.string().trim().max(20).optional() }).strict();
// Store codes are primary. Tenant codes remain a narrow API compatibility path
// while tenant join_code data is retained.
export const canonicalTenantJoinSchema = z.object({ storeInviteCode: z.string().trim().min(4).max(50).optional(), joinCode: z.string().trim().min(4).max(50).optional() }).strict().refine((value) => Boolean(value.storeInviteCode) !== Boolean(value.joinCode), 'Cung cấp một mã mời Store hoặc Tenant');
export const canonicalJoinDecisionSchema = z.object({ role: z.enum(['staff', 'leader', 'manager']), storeIds: z.array(z.coerce.number().int().positive()).min(1).max(100) }).strict();
export const canonicalMembershipStoreAccessSchema = z.object({ storeIds: z.array(z.coerce.number().int().positive()).max(100) }).strict();
export const canonicalEmploymentSchema = z.object({ employeeCode: z.string().trim().max(100).optional(), employmentType: z.string().trim().max(50).optional(), hourlyWage: z.string().trim().max(30).optional(), monthlySalary: z.string().trim().max(30).optional(), hireDate: z.string().trim().max(20).optional(), employmentStatus: z.string().trim().max(50).optional(), terminationDate: z.string().trim().max(20).optional(), terminationReason: z.string().trim().max(2000).optional() }).strict();
