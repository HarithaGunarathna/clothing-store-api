import { ProviderProfileDTO } from 'src/user/dto/providerProfileDTO';

export const GOOGLE_PROVIDER = 'google';
export const FACEBOOK_PROVIDER = 'facebook';

export interface AuthorizationRequest {
  /** Fully-built provider URL to redirect the browser to. */
  url: string;
  /** Opaque CSRF token echoed back by the provider at the callback. */
  state: string;
  /** PKCE verifier; empty when the provider is not using PKCE. */
  codeVerifier: string;
}

/**
 * Implemented once per identity provider. Everything downstream — the state
 * cookie, account provisioning, JWT issuing — is provider-agnostic and works
 * off the ProviderProfileDTO these return.
 */
export interface OAuthProviderService {
  readonly provider: string;

  /** Where to send the browser after a successful sign-in. */
  readonly frontendPostLoginUrl: string;

  createAuthorizationRequest(): AuthorizationRequest;

  /** Redeems an authorization code for a verified profile. */
  exchangeCode(code: string, codeVerifier: string): Promise<ProviderProfileDTO>;

  /**
   * Verifies a token the client obtained directly from the provider's SDK.
   * Google supplies an OIDC ID token; Facebook supplies an access token.
   */
  verifyClientToken(token: string): Promise<ProviderProfileDTO>;
}
