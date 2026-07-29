import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CodeChallengeMethod,
  OAuth2Client,
  TokenPayload,
} from 'google-auth-library';
import { createHash, randomBytes } from 'crypto';
import { GoogleConfig, GoogleOidcConfig } from 'src/config/google.config';
import { ProviderProfileDTO } from 'src/user/dto/providerProfileDTO';
import {
  AuthorizationRequest,
  GOOGLE_PROVIDER,
  OAuthProviderService,
} from './oauth-provider.interface';

export { GOOGLE_PROVIDER };

@Injectable()
export class GoogleService implements OAuthProviderService {
  readonly provider = GOOGLE_PROVIDER;

  private readonly config: GoogleOidcConfig;
  private readonly client: OAuth2Client;

  constructor(private readonly configService: ConfigService) {
    this.config = GoogleConfig(this.configService);
    this.client = new OAuth2Client({
      clientId: this.config.clientId,
      clientSecret: this.config.clientSecret,
      redirectUri: this.config.callbackUrl,
    });
  }

  get frontendPostLoginUrl(): string {
    return this.config.frontendPostLoginUrl;
  }

  /**
   * Builds the Google authorization URL along with the `state` and PKCE
   * verifier the caller must persist and present again at the callback.
   */
  createAuthorizationRequest(): AuthorizationRequest {
    const state = randomBytes(32).toString('base64url');
    const codeVerifier = randomBytes(32).toString('base64url');
    const codeChallenge = createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');

    const url = this.client.generateAuthUrl({
      scope: ['openid', 'email', 'profile'],
      state,
      code_challenge_method: CodeChallengeMethod.S256,
      code_challenge: codeChallenge,
      prompt: 'select_account',
    });

    return { url, state, codeVerifier };
  }

  /** Exchanges an authorization code (with its PKCE verifier) for a profile. */
  async exchangeCode(
    code: string,
    codeVerifier: string,
  ): Promise<ProviderProfileDTO> {
    let idToken: string | null | undefined;

    try {
      const { tokens } = await this.client.getToken({
        code,
        codeVerifier,
        redirect_uri: this.config.callbackUrl,
      });
      idToken = tokens.id_token;
    } catch {
      throw new UnauthorizedException('Google code exchange failed');
    }

    if (!idToken) {
      throw new UnauthorizedException('Google did not return an ID token');
    }

    return this.verifyIdToken(idToken);
  }

  /** Google's client-side flow hands back an OIDC ID token. */
  verifyClientToken(token: string): Promise<ProviderProfileDTO> {
    return this.verifyIdToken(token);
  }

  /**
   * Verifies an ID token's signature, issuer, audience and expiry, then maps
   * its claims onto the subset used for provisioning.
   */
  async verifyIdToken(idToken: string): Promise<ProviderProfileDTO> {
    let payload: TokenPayload | undefined;

    try {
      const ticket = await this.client.verifyIdToken({
        idToken,
        audience: this.config.clientId,
      });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException('Invalid Google ID token');
    }

    if (!payload?.sub || !payload.email) {
      throw new UnauthorizedException('Google ID token is missing claims');
    }

    return {
      provider: GOOGLE_PROVIDER,
      providerUserId: payload.sub,
      email: payload.email,
      emailVerified: payload.email_verified === true,
      firstName: payload.given_name,
      lastName: payload.family_name,
    };
  }
}
