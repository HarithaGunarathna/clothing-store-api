import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { TokenConfig, TokenConfigValues } from 'src/config/token.config';
import {
  RefreshToken,
  REVOKED_BY_LOGOUT,
  REVOKED_BY_REUSE,
  REVOKED_BY_ROTATION,
} from './model/refresh-token.entity';

export interface IssuedRefreshToken {
  /** The raw token. Only ever leaves the server in the client's cookie. */
  token: string;
  expiresAt: Date;
}

export interface RotationResult {
  userId: number;
  issued: IssuedRefreshToken;
}

/** What the rotation transaction decided, resolved into a response afterwards. */
type RotationOutcome =
  | { kind: 'rotated'; userId: number; issued: IssuedRefreshToken }
  | { kind: 'reuse'; familyId: string }
  | { kind: 'expired' }
  | { kind: 'unknown' };

@Injectable()
export class RefreshTokenService {
  private readonly config: TokenConfigValues;

  constructor(
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    private readonly dataSource: DataSource,
    configService: ConfigService,
  ) {
    this.config = TokenConfig(configService);
  }

  /**
   * Refresh tokens are high-entropy random values, so a plain SHA-256 is the
   * right hash here — there is nothing to brute-force, and lookups must be
   * fast and exact. (Passwords are a different problem and use bcrypt.)
   */
  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private expiryFromNow(): Date {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.config.refreshTokenTtlDays);
    return expiresAt;
  }

  /** Starts a new token family — i.e. a new login on a new device. */
  async issueNewFamily(userId: number): Promise<IssuedRefreshToken> {
    return this.mint(this.refreshTokenRepository.manager, userId, randomUUID());
  }

  private async mint(
    manager: EntityManager,
    userId: number,
    familyId: string,
  ): Promise<IssuedRefreshToken> {
    const token = randomBytes(48).toString('base64url');
    const expiresAt = this.expiryFromNow();

    await manager.save(
      manager.create(RefreshToken, {
        userId,
        familyId,
        tokenHash: this.hash(token),
        expiresAt,
        revokedAt: null,
        revokedReason: null,
      }),
    );

    return { token, expiresAt };
  }

  /**
   * Redeems a refresh token for its successor.
   *
   * Presenting a token that was already rotated means two parties hold a copy,
   * so the whole family is revoked rather than trying to guess which one is
   * the attacker. The only exception is the grace window, which absorbs a
   * client firing several refreshes at once.
   */
  async rotate(presentedToken: string): Promise<RotationResult> {
    const tokenHash = this.hash(presentedToken);

    // The transaction only decides what happened; it never throws. Throwing
    // here would roll back the very family revocation that reuse detection
    // depends on, leaving the stolen token usable.
    const outcome = await this.dataSource.transaction(
      async (manager): Promise<RotationOutcome> => {
        const existing = await manager.findOne(RefreshToken, {
          where: { tokenHash },
          lock: { mode: 'pessimistic_write' },
        });

        if (!existing) {
          return { kind: 'unknown' };
        }

        if (existing.expiresAt.getTime() <= Date.now()) {
          return { kind: 'expired' };
        }

        if (existing.revokedAt) {
          const withinGrace =
            existing.revokedReason === REVOKED_BY_ROTATION &&
            Date.now() - existing.revokedAt.getTime() <=
              this.config.refreshReuseGraceSeconds * 1000 &&
            // A token rotated moments before the family was torn down is still
            // inside its grace window; without this check the grace path would
            // hand out a live token for an already-compromised session.
            !(await this.isFamilyTerminated(manager, existing.familyId));

          if (!withinGrace) {
            return { kind: 'reuse', familyId: existing.familyId };
          }

          // Concurrent refresh: hand out another token in the same family
          // instead of tearing the session down.
          return {
            kind: 'rotated',
            userId: existing.userId,
            issued: await this.mint(
              manager,
              existing.userId,
              existing.familyId,
            ),
          };
        }

        existing.revokedAt = new Date();
        existing.revokedReason = REVOKED_BY_ROTATION;
        await manager.save(RefreshToken, existing);

        return {
          kind: 'rotated',
          userId: existing.userId,
          issued: await this.mint(manager, existing.userId, existing.familyId),
        };
      },
    );

    if (outcome.kind === 'rotated') {
      return { userId: outcome.userId, issued: outcome.issued };
    }

    if (outcome.kind === 'reuse') {
      // Committed in its own transaction, after the lock above is released, so
      // the revocation survives the failed request.
      await this.revokeFamily(
        this.refreshTokenRepository.manager,
        outcome.familyId,
        REVOKED_BY_REUSE,
      );
      throw new UnauthorizedException(
        'Refresh token was already used; session revoked',
      );
    }

    throw new UnauthorizedException(
      outcome.kind === 'expired'
        ? 'Refresh token has expired'
        : 'Invalid refresh token',
    );
  }

  /** Logout: ends the session this token belongs to, leaving other devices alone. */
  async revokeFamilyOf(presentedToken: string): Promise<void> {
    const existing = await this.refreshTokenRepository.findOne({
      where: { tokenHash: this.hash(presentedToken) },
    });

    if (!existing) {
      // Nothing to revoke — logout stays idempotent and leaks no information
      // about whether the token was real.
      return;
    }

    await this.revokeFamily(
      this.refreshTokenRepository.manager,
      existing.familyId,
      REVOKED_BY_LOGOUT,
    );
  }

  /**
   * Ends every session a user has, on all devices.
   *
   * Used when a role changes: the role is a claim inside the access token, so
   * the old one keeps working until it expires. Killing the refresh tokens
   * stops it being renewed, bounding the stale privilege to one access-token
   * lifetime instead of thirty days.
   */
  async revokeAllForUser(userId: number): Promise<number> {
    const result = await this.refreshTokenRepository
      .createQueryBuilder()
      .update(RefreshToken)
      .set({ revokedAt: new Date(), revokedReason: REVOKED_BY_LOGOUT })
      .where('user_id = :userId', { userId })
      .andWhere('revoked_at IS NULL')
      .execute();

    return result.affected ?? 0;
  }

  /** True once a family has been ended deliberately, by logout or reuse detection. */
  private async isFamilyTerminated(
    manager: EntityManager,
    familyId: string,
  ): Promise<boolean> {
    const terminated = await manager.count(RefreshToken, {
      where: [
        { familyId, revokedReason: REVOKED_BY_REUSE },
        { familyId, revokedReason: REVOKED_BY_LOGOUT },
      ],
    });
    return terminated > 0;
  }

  private async revokeFamily(
    manager: EntityManager,
    familyId: string,
    reason: string,
  ): Promise<void> {
    await manager
      .createQueryBuilder()
      .update(RefreshToken)
      .set({ revokedAt: new Date(), revokedReason: reason })
      .where('family_id = :familyId', { familyId })
      .andWhere('revoked_at IS NULL')
      .execute();
  }
}
