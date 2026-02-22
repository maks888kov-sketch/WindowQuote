export const ALLOWED_ROLES = ["admin", "manager", "measurer", "worker"];

export const isAllowedRole = (role) => ALLOWED_ROLES.includes(role);
