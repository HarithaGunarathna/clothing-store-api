import { TimedEntity } from 'src/common/entity/timed.entity';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
} from 'typeorm';
import { User } from 'src/user/model/user.entity';

/** Why a token stopped being usable. Only `rotated` is eligible for the grace window. */
export const REVOKED_BY_ROTATION = 'rotated';
export const REVOKED_BY_REUSE = 'reuse_detected';
export const REVOKED_BY_LOGOUT = 'logout';

/**
 * One row per refresh token ever issued. Tokens are stored as a SHA-256 hash,
 * never in the clear — the raw value exists only in the client's cookie.
 *
 * A `familyId` groups every token descended from a single login, so one
 * compromised token can take down that session without touching the user's
 * other devices.
 */
@Entity('refresh_tokens')
@Unique('UQ_refresh_tokens_token_hash', ['tokenHash'])
export class RefreshToken extends TimedEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Index('IDX_refresh_tokens_user_id')
  @Column({ name: 'user_id' })
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'FK_refresh_tokens_user',
  })
  user: User;

  @Index('IDX_refresh_tokens_family_id')
  @Column({ name: 'family_id', type: 'varchar', length: 64 })
  familyId: string;

  @Column({ name: 'token_hash', type: 'varchar', length: 64 })
  tokenHash: string;

  @Column({ name: 'expires_at', type: 'timestamp' })
  expiresAt: Date;

  @Column({ name: 'revoked_at', type: 'timestamp', nullable: true })
  revokedAt: Date | null;

  @Column({
    name: 'revoked_reason',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  revokedReason: string | null;
}
