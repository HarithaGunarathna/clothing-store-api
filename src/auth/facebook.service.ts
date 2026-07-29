import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, randomBytes } from 'crypto';
import { FacebookAuthConfig, FacebookConfig } from 'src/config/facebook.config';
import { ProviderProfileDTO } from 'src/user/dto/providerProfileDTO';
import {
  AuthorizationRequest,
  FACEBOOK_PROVIDER,
  OAuthProviderService,
} from './oauth-provider.interface';

interface TokenResponse {
  access_token?: string;
  error?: { message?: string };
}

interface DebugTokenResponse {
  data?: {
    app_id?: string;
    is_valid?: boolean;
    user_id?: string;
  };
}

interface GraphMeResponse {
  id?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
}

@Injectable()
export class FacebookService implements OAuthProviderService {
  readonly provider = FACEBOOK_PROVIDER;

  private readonly config: FacebookAuthConfig;

  constructor(private readonly configService: ConfigService) {
    this.config = FacebookConfig(this.configService);
  }

  get frontendPostLoginUrl(): string {
    return this.config.frontendPostLoginUrl;
  }

  private get graphBase(): string {
    return `https://graph.facebook.com/${this.config.graphVersion}`;
  }

  createAuthorizationRequest(): AuthorizationRequest {
    const state = randomBytes(32).toString('base64url');
    const codeVerifier = randomBytes(32).toString('base64url');
    const codeChallenge = createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');

    const url = new URL(
      `https://www.facebook.com/${this.config.graphVersion}/dialog/oauth`,
    );
    url.searchParams.set('client_id', this.config.clientId);
    url.searchParams.set('redirect_uri', this.config.callbackUrl);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'email,public_profile');
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge_method', 'S256');
    url.searchParams.set('code_challenge', codeChallenge);

    return { url: url.toString(), state, codeVerifier };
  }

  async exchangeCode(
    code: string,
    codeVerifier: string,
  ): Promise<ProviderProfileDTO> {
    const url = new URL(`${this.graphBase}/oauth/access_token`);
    url.searchParams.set('client_id', this.config.clientId);
    url.searchParams.set('client_secret', this.config.clientSecret);
    url.searchParams.set('redirect_uri', this.config.callbackUrl);
    url.searchParams.set('code', code);
    if (codeVerifier) {
      url.searchParams.set('code_verifier', codeVerifier);
    }

    const body = await this.getJson<TokenResponse>(
      url,
      'Facebook code exchange failed',
    );

    if (!body.access_token) {
      throw new UnauthorizedException('Facebook code exchange failed');
    }

    return this.verifyClientToken(body.access_token);
  }

  /**
   * Facebook's client-side flow hands back an access token rather than an ID
   * token, so it cannot be verified by signature. Instead the token is
   * inspected server-side via debug_token, which is also the only way to
   * confirm it was issued for *this* app — without that check a token minted
   * for any other Facebook app would be accepted here.
   */
  async verifyClientToken(accessToken: string): Promise<ProviderProfileDTO> {
    const debugUrl = new URL('https://graph.facebook.com/debug_token');
    debugUrl.searchParams.set('input_token', accessToken);
    debugUrl.searchParams.set(
      'access_token',
      `${this.config.clientId}|${this.config.clientSecret}`,
    );

    const debug = await this.getJson<DebugTokenResponse>(
      debugUrl,
      'Invalid Facebook access token',
    );

    if (!debug.data?.is_valid || !debug.data.user_id) {
      throw new UnauthorizedException('Invalid Facebook access token');
    }

    if (debug.data.app_id !== this.config.clientId) {
      throw new UnauthorizedException(
        'Facebook token was issued for a different app',
      );
    }

    const profile = await this.fetchProfile(accessToken);

    if (!profile.id) {
      throw new UnauthorizedException('Facebook profile is missing an id');
    }

    // Facebook only exposes an email once the user has confirmed it, but the
    // Graph API reports no explicit verification flag. It is treated as
    // verified here — this single line is what allows a Facebook sign-in to
    // link onto an existing account by email.
    if (!profile.email) {
      throw new UnauthorizedException(
        'Your Facebook account did not share an email address. Grant the email permission, or sign in another way.',
      );
    }

    return {
      provider: FACEBOOK_PROVIDER,
      providerUserId: profile.id,
      email: profile.email,
      emailVerified: true,
      firstName: profile.first_name,
      lastName: profile.last_name,
    };
  }

  private async fetchProfile(accessToken: string): Promise<GraphMeResponse> {
    const url = new URL(`${this.graphBase}/me`);
    url.searchParams.set('fields', 'id,first_name,last_name,email');
    url.searchParams.set('access_token', accessToken);
    // Signs the call with the app secret so a stolen access token alone cannot
    // be replayed against the Graph API from elsewhere.
    url.searchParams.set(
      'appsecret_proof',
      createHmac('sha256', this.config.clientSecret)
        .update(accessToken)
        .digest('hex'),
    );

    return this.getJson<GraphMeResponse>(
      url,
      'Could not read Facebook profile',
    );
  }

  private async getJson<T>(url: URL, failureMessage: string): Promise<T> {
    let response: Response;

    try {
      response = await fetch(url, { method: 'GET' });
    } catch {
      throw new UnauthorizedException(failureMessage);
    }

    if (!response.ok) {
      throw new UnauthorizedException(failureMessage);
    }

    try {
      return (await response.json()) as T;
    } catch {
      throw new UnauthorizedException(failureMessage);
    }
  }
}
