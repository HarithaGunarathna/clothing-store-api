/**
 * The subset of verified claims from an identity provider that account
 * provisioning needs. Built only from a token that has already been verified.
 */
export class ProviderProfileDTO {
  readonly provider: string;
  /** The provider's stable subject identifier (OIDC `sub`). */
  readonly providerUserId: string;
  readonly email: string;
  readonly emailVerified: boolean;
  readonly firstName?: string;
  readonly lastName?: string;
}
