import { Body, Controller, Post, HttpCode, Req, Res, Get, Query, BadRequestException, UnauthorizedException } from '@nestjs/common';
import {
    ApiCookieAuth,
    ApiOkResponse,
    ApiOperation,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import { LoginDTO } from 'src/user/dto/loginDTO';
import type { CookieOptions, Request, Response } from 'express';
import { AuthService, AuthSession } from './auth.service';
import { NewUserDTO } from 'src/user/dto/createUserDTO';
import { ProviderTokenDTO } from 'src/user/dto/providerTokenDTO';
import {
    FACEBOOK_PROVIDER,
    GOOGLE_PROVIDER,
} from './oauth-provider.interface';

/** Per-provider so starting one sign-in cannot clobber another's state. */
const stateCookieName = (provider: string) => `oauth_state_${provider}`;

export const REFRESH_COOKIE = 'refresh_token';

/**
 * Scoped to /auth so the refresh token is only ever sent to the endpoints that
 * consume it, and never rides along on ordinary API calls.
 */
const refreshCookieOptions = (expiresAt: Date): CookieOptions => ({
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/auth',
    expires: expiresAt,
});

@ApiTags('auth')
@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @ApiOperation({ summary: 'Sign in with username and password', description: 'Returns an access token and sets the httpOnly refresh cookie.' })
    @ApiOkResponse({ description: 'Signed in.' })
    @ApiResponse({ status: 401, description: 'Bad credentials, or the account has no password because it uses social sign-in.' })
    @Post('login')
    @HttpCode(200)
    async login(
        @Body() loginDto: LoginDTO,
        @Res({ passthrough: true }) response: Response,
    ): Promise<{ access_token: string }> {
        const session = await this.authService.signIn(loginDto.userName, loginDto.password);
        return this.completeSession(session, response);
    }

    @ApiOperation({ summary: 'Register a new user', description: 'Signs the new user straight in — there is no separate login step and no email verification.' })
    @ApiResponse({ status: 201, description: 'Registered and signed in.' })
    @ApiResponse({ status: 401, description: 'Username already taken.' })
    @Post('register')
    @HttpCode(201)
    async register(
        @Body() userData: NewUserDTO,
        @Res({ passthrough: true }) response: Response,
    ): Promise<{ access_token: string }> {
        const session = await this.authService.registerUser(userData);
        return this.completeSession(session, response);
    }

    /**
     * Trades the refresh cookie for a new access token, rotating the cookie in
     * the process. The client never sends anything in the body — the cookie is
     * the credential.
     */
    @ApiCookieAuth('refresh_token')
    @ApiOperation({ summary: 'Rotate the refresh token for a new access token', description: 'No request body — the httpOnly cookie is the credential. The cookie is rotated on every success; a 401 here is terminal, so send the user to sign in rather than retrying.' })
    @ApiOkResponse({ description: 'New access token issued, refresh cookie rotated.' })
    @ApiResponse({ status: 401, description: 'Missing, expired, or already-used refresh token. Reuse revokes the whole session.' })
    @Post('refresh')
    @HttpCode(200)
    async refresh(
        @Req() request: Request,
        @Res({ passthrough: true }) response: Response,
    ): Promise<{ access_token: string }> {
        const presented = request.cookies?.[REFRESH_COOKIE] as string | undefined;

        if (!presented) {
            throw new UnauthorizedException('Missing refresh token');
        }

        try {
            const session = await this.authService.refreshSession(presented);
            return this.completeSession(session, response);
        } catch (error) {
            // The cookie is spent either way; leaving it in place would make the
            // client retry forever with a token that can never work again.
            response.clearCookie(REFRESH_COOKIE, { path: '/auth' });
            throw error;
        }
    }

    /** Ends this session only. Other devices keep their own families. */
    @ApiCookieAuth('refresh_token')
    @ApiOperation({ summary: 'End this session', description: 'Revokes this token family and clears the cookie. Other devices are unaffected. Returns 204 whether or not a valid cookie was sent.' })
    @ApiResponse({ status: 204, description: 'Session ended.' })
    @Post('logout')
    @HttpCode(204)
    async logout(
        @Req() request: Request,
        @Res({ passthrough: true }) response: Response,
    ): Promise<void> {
        await this.authService.logout(request.cookies?.[REFRESH_COOKIE] as string | undefined);
        response.clearCookie(REFRESH_COOKIE, { path: '/auth' });
    }

    // ─── Google ──────────────────────────────────────────────────────────────

    @ApiOperation({ summary: 'Begin Google sign-in', description: 'Navigate the browser here — not fetch/XHR. Redirects to Google with state and a PKCE challenge.' })
    @ApiResponse({ status: 302, description: 'Redirect to Google.' })
    @Get('google')
    async googleRedirect(@Res() response: Response): Promise<void> {
        await this.startRedirectFlow(GOOGLE_PROVIDER, response);
    }

    @ApiOperation({ summary: 'Google returns here', description: 'Verifies state against the cookie, redeems the code, then redirects to FRONTEND_POST_LOGIN_URL with the refresh cookie set. No token appears in the URL.' })
    @ApiResponse({ status: 302, description: 'Redirect to the frontend.' })
    @ApiResponse({ status: 401, description: 'Missing, mismatched, or wrong-provider state cookie.' })
    @Get('google/callback')
    async googleCallback(
        @Query('code') code: string,
        @Query('state') state: string,
        @Req() request: Request,
        @Res() response: Response,
    ): Promise<void> {
        await this.completeRedirectFlow(GOOGLE_PROVIDER, code, state, request, response);
    }

    @ApiOperation({ summary: 'Exchange a Google ID token for a session', description: 'For clients using the Google SDK. Body: { idToken }.' })
    @ApiOkResponse({ description: 'Signed in.' })
    @ApiResponse({ status: 400, description: 'idToken missing.' })
    @ApiResponse({ status: 401, description: 'ID token failed verification.' })
    @Post('google/token')
    @HttpCode(200)
    async googleToken(
        @Body() body: ProviderTokenDTO,
        @Res({ passthrough: true }) response: Response,
    ): Promise<{ access_token: string }> {
        return this.exchangeClientToken(GOOGLE_PROVIDER, body?.idToken, 'idToken', response);
    }

    // ─── Facebook ────────────────────────────────────────────────────────────

    @ApiOperation({ summary: 'Begin Facebook sign-in', description: 'Navigate the browser here — not fetch/XHR.' })
    @ApiResponse({ status: 302, description: 'Redirect to Facebook.' })
    @Get('facebook')
    async facebookRedirect(@Res() response: Response): Promise<void> {
        await this.startRedirectFlow(FACEBOOK_PROVIDER, response);
    }

    @ApiOperation({ summary: 'Facebook returns here' })
    @ApiResponse({ status: 302, description: 'Redirect to the frontend.' })
    @ApiResponse({ status: 401, description: 'Missing, mismatched, or wrong-provider state cookie.' })
    @Get('facebook/callback')
    async facebookCallback(
        @Query('code') code: string,
        @Query('state') state: string,
        @Req() request: Request,
        @Res() response: Response,
    ): Promise<void> {
        await this.completeRedirectFlow(FACEBOOK_PROVIDER, code, state, request, response);
    }

    @ApiOperation({ summary: 'Exchange a Facebook access token for a session', description: 'For clients using the Facebook SDK. Body: { accessToken } — note Facebook yields an access token, not an ID token.' })
    @ApiOkResponse({ description: 'Signed in.' })
    @ApiResponse({ status: 400, description: 'accessToken missing.' })
    @ApiResponse({ status: 401, description: 'Token invalid, or issued for a different Facebook app.' })
    @Post('facebook/token')
    @HttpCode(200)
    async facebookToken(
        @Body() body: ProviderTokenDTO,
        @Res({ passthrough: true }) response: Response,
    ): Promise<{ access_token: string }> {
        return this.exchangeClientToken(
            FACEBOOK_PROVIDER,
            body?.accessToken,
            'accessToken',
            response,
        );
    }

    @ApiOperation({ summary: 'List all users', description: 'WARNING: unauthenticated and returns full user rows including the password hash. Do not build on this; it needs guarding and field selection.' })
    @Get('all-users')
    @HttpCode(200)
    async getAllUsers(): Promise<any> {
        const response = await this.authService.getAllUsers();
        return response;
    }

    // ─── Shared flow handling ────────────────────────────────────────────────

    /** Sets the refresh cookie and hands the access token back in the body. */
    private completeSession(
        session: AuthSession,
        response: Response,
    ): { access_token: string } {
        response.cookie(
            REFRESH_COOKIE,
            session.refresh.token,
            refreshCookieOptions(session.refresh.expiresAt),
        );
        return { access_token: session.access_token };
    }

    /** Step 1 of the redirect flow — hand the browser off to the provider. */
    private async startRedirectFlow(
        provider: string,
        response: Response,
    ): Promise<void> {
        const { url, stateCookie } =
            await this.authService.createAuthorizationRequest(provider);

        response.cookie(stateCookieName(provider), stateCookie, {
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            maxAge: 10 * 60 * 1000,
        });
        response.redirect(url);
    }

    /** Step 2 — the provider returns here with the authorization code. */
    private async completeRedirectFlow(
        provider: string,
        code: string,
        state: string,
        request: Request,
        response: Response,
    ): Promise<void> {
        if (!code) {
            throw new BadRequestException('Missing authorization code');
        }

        const cookieName = stateCookieName(provider);
        const session = await this.authService.completeAuthorization(
            provider,
            code,
            state,
            request.cookies?.[cookieName] as string | undefined,
        );

        response.clearCookie(cookieName);
        response.cookie(
            REFRESH_COOKIE,
            session.refresh.token,
            refreshCookieOptions(session.refresh.expiresAt),
        );

        // No token in the URL: the browser lands on a clean address and the app
        // calls POST /auth/refresh to pick up its first access token. Keeps
        // credentials out of browser history, logs and the Referer header.
        response.redirect(
            this.authService.providerFor(provider).frontendPostLoginUrl,
        );
    }

    private async exchangeClientToken(
        provider: string,
        token: string | undefined,
        fieldName: string,
        response: Response,
    ): Promise<{ access_token: string }> {
        if (!token) {
            throw new BadRequestException(`${fieldName} is required`);
        }
        const session = await this.authService.signInWithClientToken(provider, token);
        return this.completeSession(session, response);
    }
}
