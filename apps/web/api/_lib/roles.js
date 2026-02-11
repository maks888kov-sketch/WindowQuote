export const ALLOWED_ROLES = ["admin", "worker", "manager", "viewer"];

export const isAllowedRole = (role) => ALLOWED_ROLES.includes(role);
