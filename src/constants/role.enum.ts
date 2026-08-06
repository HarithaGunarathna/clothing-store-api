export enum Role {
  Buyer = 'buyer',
  Admin = 'admin',
  SuperAdmin = 'super_admin',
}

/** For validating input and building CHECK constraints. */
export const ROLES = Object.values(Role);

/** Roles that sign in through the admin endpoint rather than the storefront. */
export const ADMIN_ROLES: string[] = [Role.Admin, Role.SuperAdmin];

export const isAdminRole = (role: string): boolean =>
  ADMIN_ROLES.includes(role);

export const isSuperAdminRole = (role: string): boolean =>
  role === (Role.SuperAdmin as string);
