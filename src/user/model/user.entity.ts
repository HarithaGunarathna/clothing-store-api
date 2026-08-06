import { TimedEntity } from 'src/common/entity/timed.entity';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  BeforeInsert,
  OneToMany,
  Unique,
  Check,
} from 'typeorm';
import bcrypt from 'bcryptjs';
import { UserIdentity } from './user-identity.entity';

// Unique constraints are declared here rather than via `unique: true` on the
// column so their names match the migration; otherwise TypeORM derives hashed
// names and every `migration:generate` reports phantom drift.
@Entity('users')
@Check('CHK_users_role', `"role" IN ('buyer','admin','super_admin')`)
@Unique('UQ_users_email', ['email'])
@Unique('UQ_users_user_name', ['userName'])
export class User extends TimedEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'first_name', type: 'varchar', length: 100, nullable: true })
  firstName: string;

  @Column({ name: 'last_name', type: 'varchar', length: 100, nullable: true })
  lastName: string;

  // Nullable: users provisioned through an identity provider have no username.
  // The type is explicit because the `string | null` union erases to Object,
  // which TypeORM cannot map on its own.
  @Column({ name: 'user_name', type: 'varchar', length: 255, nullable: true })
  userName: string | null;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ name: 'email_verified', type: 'boolean', default: false })
  emailVerified: boolean;

  @Column({ name: 'phone_number', type: 'varchar', length: 20, nullable: true })
  phoneNumber: string;

  @Column({ name: 'date_of_birth', type: 'date', nullable: true })
  dob: Date;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'varchar', length: 50 })
  role: string;

  // Nullable: users provisioned through an identity provider have no password.
  @Column({ name: 'password', type: 'varchar', length: 255, nullable: true })
  passwordHash: string | null;

  @OneToMany(() => UserIdentity, (identity) => identity.user)
  identities: UserIdentity[];

  @BeforeInsert()
  async hashPassword() {
    if (this.passwordHash) {
      const salt = await bcrypt.genSalt(10);
      this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
    }
  }
}
