import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserService } from 'src/user/user.service';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { User } from 'src/user/model/user.entity';
import { NewUserDTO } from 'src/user/dto/createUserDTO';
import { ProviderProfileDTO } from 'src/user/dto/providerProfileDTO';
import { GoogleService } from './google.service';
import { FacebookService } from './facebook.service';
import { OAuthProviderService } from './oauth-provider.interface';
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
        this.providers = new Map([
            [googleService.provider, googleService as OAuthProviderService],
            [facebookService.provider, facebookService as OAuthProviderService],
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
        const payload = { userId: user.id, username: user.userName };
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

    async signIn(userName: string, password: string): Promise<AuthSession> {

        const user: User | null = await this.userService.findUserByUsername(userName);

        if (!user) {
            throw new UnauthorizedException("User Does Not Exist");
        }

        // Users provisioned through an identity provider have no password —
        // reject them here rather than letting bcrypt.compare throw on null.
        if (!user.passwordHash) {
            throw new UnauthorizedException("This account uses social sign-in");
        }

        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

        if (!isPasswordValid) {
            throw new UnauthorizedException("Incorrect Username or Password");
        }
        return this.issueSessionForUser(user);
    }

    async registerUser(userData: NewUserDTO): Promise<AuthSession> {
        const existingUser = await this.userService.findUserByUsername(userData.userName);
        if (existingUser) {
            throw new UnauthorizedException("User Already Exists");
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
        const profile = await this.providerFor(providerName).verifyClientToken(token);
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
            payload = await this.jwtService.verifyAsync<OAuthStatePayload>(stateCookie);
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

    async getAllUsers(): Promise<User[]> {
        return this.userService.getAllUsers();
    }
}
