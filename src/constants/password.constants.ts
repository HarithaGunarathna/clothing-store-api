/**
 * Shared by the two ways an administrator can be created — the
 * `admin:create` CLI script and `POST /api/v1/admin/create-admin` — so the
 * rule cannot drift between them.
 */
export const MIN_PASSWORD_LENGTH = 6;
