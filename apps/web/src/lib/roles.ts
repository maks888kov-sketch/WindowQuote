export const ALLOWED_ROLES = ["admin", "worker", "manager", "viewer"] as const;

export type AllowedRole = (typeof ALLOWED_ROLES)[number];

export const isAllowedRole = (role: string): role is AllowedRole =>
  ALLOWED_ROLES.includes(role as AllowedRole);
