import { Injectable, UnauthorizedException } from '@nestjs/common';
import { isAdminRole } from 'src/constants/role.enum';
import { UserService } from 'src/user/user.service';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { User } from 'src/user/model/user.entity';
import { NewUserDTO } from 'src/user/dto/createUserDTO';
import { ProviderProfileDTO } from 'src/user/dto/providerProfileDTO';
import { AddressDTO, MeResponseDTO } from 'src/user/dto/meDTO';
import { Address } from 'src/user/model/address.entity';
import { GoogleService } from './google.service';
import { FacebookService } from './facebook.service';
import { OAuthProviderService } from './oauth-provider.interface';
import { AccessTokenPayload } from './authenticated-request';
import {
  IssuedRefreshToken,
  RefreshTokenService,
} from './refresh-token.service';

/** Payload carried in the short-lived cookie that guards the redirect flow. */
interface OAuthStatePayload {
  provider: string;
  state: string;
  codeVerifier: string;
}

/**
 * What every successful sign-in produces: a short-lived access token for the
 * response body, and a refresh token the controller puts in an httpOnly cookie.
 */
export interface AuthSession {
  access_token: string;
  refresh: IssuedRefreshToken;
}

@Injectable()
export class AuthService {
  private readonly providers: Map<string, OAuthProviderService>;

  constructor(
    private readonly userService: UserService,
    private jwtService: JwtService,
    private readonly refreshTokenService: RefreshTokenService,
    googleService: GoogleService,
    facebookService: FacebookService,
  ) {
    // Annotated rather than asserted per entry: without the generic, TypeScript
    // infers Map<string, GoogleService> from the first entry and rejects the
    // second.
    this.providers = new Map<string, OAuthProviderService>([
      [googleService.provider, googleService],
      [facebookService.provider, facebookService],
    ]);
  }

  providerFor(name: string): OAuthProviderService {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new UnauthorizedException(`Unsupported provider: ${name}`);
    }
    return provider;
  }

  /** Mints an access token only — used when refreshing an existing session. */
  private async issueAccessToken(user: User): Promise<string> {
    // `role` is re-read from the user row on every refresh, so a role change
    // takes effect at the next refresh rather than requiring a full sign-in.
    const payload: AccessTokenPayload = {
      userId: user.id,
      username: user.userName,
      role: user.role,
    };
    return this.jwtService.signAsync(payload);
  }

  /** Starts a new session: access token plus a fresh refresh token family. */
  async issueSessionForUser(user: User): Promise<AuthSession> {
    return {
      access_token: await this.issueAccessToken(user),
      refresh: await this.refreshTokenService.issueNewFamily(user.id),
    };
  }

  /**
   * Redeems a refresh token for a new access token and its replacement
   * refresh token. Reuse of an already-rotated token revokes the session.
   */
  async refreshSession(presentedToken: string): Promise<AuthSession> {
    const { userId, issued } =
      await this.refreshTokenService.rotate(presentedToken);

    const user = await this.userService.findUserById(userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Account is no longer active');
    }

    return {
      access_token: await this.issueAccessToken(user),
      refresh: issued,
    };
  }

  async logout(presentedToken: string | undefined): Promise<void> {
    if (!presentedToken) {
      return;
    }
    await this.refreshTokenService.revokeFamilyOf(presentedToken);
  }

  /** Password check shared by the storefront and admin sign-ins. */
  private async authenticateWithPassword(
    userName: string,
    password: string,
  ): Promise<User> {
    const user: User | null =
      await this.userService.findUserByUsername(userName);

    if (!user) {
      throw new UnauthorizedException('User Does Not Exist');
    }

    // Users provisioned through an identity provider have no password —
    // reject them here rather than letting bcrypt.compare throw on null.
    if (!user.passwordHash) {
      throw new UnauthorizedException('This account uses social sign-in');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Incorrect Username or Password');
    }

    // Checked here as well as in refreshSession: without it, deactivating an
    // account would only end its current sessions and the user would simply
    // sign in again.
    if (!user.isActive) {
      throw new UnauthorizedException('This account has been deactivated');
    }

    return user;
  }

  /**
   * Storefront sign-in. Administrators are turned away here and must use
   * `adminSignIn`, so an admin credential is useless on the public form.
   */
  async signIn(userName: string, password: string): Promise<AuthSession> {
    const user = await this.authenticateWithPassword(userName, password);

    if (isAdminRole(user.role)) {
      // Deliberately the same message a wrong password gets: a distinct one
      // would let anyone discover which usernames are administrators simply by
      // trying them here.
      throw new UnauthorizedException('Incorrect Username or Password');
    }

    return this.issueSessionForUser(user);
  }

  /**
   * Admin sign-in. Username and password only — there is no social equivalent,
   * and `UserService.findOrCreateFromProvider` refuses to resolve any provider
   * profile to an administrator.
   */
  async adminSignIn(userName: string, password: string): Promise<AuthSession> {
    const user = await this.authenticateWithPassword(userName, password);

    if (!isAdminRole(user.role)) {
      // Same reasoning as above, in reverse: a buyer probing this endpoint
      // learns nothing about which accounts are privileged.
      throw new UnauthorizedException('Incorrect Username or Password');
    }

    return this.issueSessionForUser(user);
  }

  /**
   * Self-registration always produces a buyer. Any `role` in the request body
   * is ignored rather than rejected, so a client sending one gets an account —
   * just not the one it asked for.
   */
  async registerUser(userData: NewUserDTO): Promise<AuthSession> {
    const existingUser = await this.userService.findUserByUsername(
      userData.userName,
    );
    if (existingUser) {
      throw new UnauthorizedException('User Already Exists');
    }
    const newUser = await this.userService.createUser(userData);

    return this.issueSessionForUser(newUser);
  }

  /** Every provider flow converges here once a profile has been verified. */
  async signInWithProviderProfile(
    profile: ProviderProfileDTO,
  ): Promise<AuthSession> {
    const user = await this.userService.findOrCreateFromProvider(profile);
    return this.issueSessionForUser(user);
  }

  /** Client-side flow: the client already holds a token from the provider. */
  async signInWithClientToken(
    providerName: string,
    token: string,
  ): Promise<AuthSession> {
    const profile =
      await this.providerFor(providerName).verifyClientToken(token);
    return this.signInWithProviderProfile(profile);
  }

  /**
   * Starts the redirect flow: returns the provider URL plus a signed,
   * short-lived cookie value binding the `state` and PKCE verifier to this
   * browser. The callback refuses to proceed without a matching cookie.
   */
  async createAuthorizationRequest(providerName: string): Promise<{
    url: string;
    stateCookie: string;
  }> {
    const provider = this.providerFor(providerName);
    const { url, state, codeVerifier } = provider.createAuthorizationRequest();

    const stateCookie = await this.jwtService.signAsync(
      {
        provider: provider.provider,
        state,
        codeVerifier,
      } satisfies OAuthStatePayload,
      { expiresIn: '10m' },
    );

    return { url, stateCookie };
  }

  async completeAuthorization(
    providerName: string,
    code: string,
    state: string,
    stateCookie: string | undefined,
  ): Promise<AuthSession> {
    const provider = this.providerFor(providerName);

    if (!stateCookie) {
      throw new UnauthorizedException('Missing OAuth state cookie');
    }

    let payload: OAuthStatePayload;
    try {
      payload =
        await this.jwtService.verifyAsync<OAuthStatePayload>(stateCookie);
    } catch {
      throw new UnauthorizedException('Invalid OAuth state cookie');
    }

    // A cookie issued for one provider must not be replayed at another
    // provider's callback.
    if (payload.provider !== provider.provider) {
      throw new UnauthorizedException('OAuth state provider mismatch');
    }

    // CSRF defence: the state returned by the provider must match the one
    // issued to this browser.
    if (!state || state !== payload.state) {
      throw new UnauthorizedException('OAuth state mismatch');
    }

    const profile = await provider.exchangeCode(code, payload.codeVerifier);
    return this.signInWithProviderProfile(profile);
  }

  /**
   * The signed-in user's own profile. Called only with the id the guard read
   * out of a verified token, never with anything the client supplied, so one
   * user cannot ask for another's details.
   */
  async getProfile(userId: number): Promise<MeResponseDTO> {
    const user = await this.userService.findUserWithIdentities(userId);
    if (!user) {
      // A valid token for a user that no longer exists.
      throw new UnauthorizedException('Account no longer exists');
    }

    const addresses = await this.userService.findDefaultAddresses(userId);
    const toDTO = (address?: Address): AddressDTO | null =>
      address
        ? {
            id: address.id,
            label: address.label,
            line1: address.line1,
            line2: address.line2,
            city: address.city,
            postalCode: address.postalCode,
            country: address.country,
            phone: address.phone,
          }
        : null;

    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      userName: user.userName,
      email: user.email,
      emailVerified: user.emailVerified,
      phoneNumber: user.phoneNumber,
      // `date` columns come back as 'YYYY-MM-DD' strings from the driver.
      dob: user.dob as unknown as string | null,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      // The hash itself never leaves the server — only whether one exists.
      hasPassword: user.passwordHash !== null,
      connectedProviders: (user.identities ?? []).map(
        (identity) => identity.provider,
      ),
      defaultBillingAddress: toDTO(
        addresses.find((address) => address.isDefaultBilling),
      ),
      defaultDeliveryAddress: toDTO(
        addresses.find((address) => address.isDefaultShipping),
      ),
    };
  }

  async getAllUsers(): Promise<User[]> {
    return this.userService.getAllUsers();
  }
}
