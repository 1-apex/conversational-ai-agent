export const ROLES = ["ADMIN", "SUPERVISOR", "SUPPORT_AGENT", "AUDITOR"] as const;
export type Role = (typeof ROLES)[number];

export type Permission =
  | "analytics:read" | "calls:read" | "calls:delete" | "transcript:read" | "transcript:read_assigned"
  | "escalations:read" | "escalations:read_all" | "escalations:write" | "escalations:assign"
  | "reviews:write" | "knowledge:read" | "knowledge:upload" | "knowledge:approve"
  | "evaluations:read" | "evaluations:admin" | "audit:read" | "sessions:manage" | "ops:read";

// The table in docs/05-security-and-privacy.md, enforced on the server for every request.
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  ADMIN: [
    "analytics:read", "knowledge:read", "knowledge:upload", "knowledge:approve",
    "evaluations:read", "evaluations:admin", "sessions:manage", "ops:read",
  ],
  SUPERVISOR: [
    "analytics:read", "calls:read", "calls:delete", "transcript:read", "escalations:read",
    "escalations:read_all", "escalations:write", "escalations:assign", "reviews:write",
    "knowledge:read", "knowledge:approve", "evaluations:read", "ops:read",
  ],
  SUPPORT_AGENT: ["escalations:read", "escalations:write", "transcript:read_assigned"],
  AUDITOR: ["analytics:read", "calls:read", "transcript:read", "audit:read", "evaluations:read", "knowledge:read"],
};

export function hasPermission(roles: string[], permission: Permission): boolean {
  return roles.some((role) => ROLE_PERMISSIONS[role as Role]?.includes(permission));
}
