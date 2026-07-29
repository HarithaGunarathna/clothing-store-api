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
import { User } from './user.entity';

/**
 * A link between a local user and an external identity provider. One user may
 * hold several, so additional providers can be added without schema changes.
 */
@Entity('user_identities')
@Unique('UQ_user_identities_provider_subject', ['provider', 'providerUserId'])
export class UserIdentity extends TimedEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Index('IDX_user_identities_user_id')
  @Column({ name: 'user_id' })
  userId: number;

  @ManyToOne(() => User, (user) => user.identities, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'FK_user_identities_user',
  })
  user: User;

  @Column({ type: 'varchar', length: 50 })
  provider: string;

  /** The provider's stable subject identifier — the OIDC `sub` claim. */
  @Column({ name: 'provider_user_id', type: 'varchar', length: 255 })
  providerUserId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string;
}
