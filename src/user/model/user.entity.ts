
import { TimedEntity } from 'src/common/entity/timed.entity';
import { Entity, Column, PrimaryGeneratedColumn, BeforeInsert, Unique, Table } from 'typeorm';
import bcrypt from 'node_modules/bcryptjs';

@Entity('users')
export class User extends TimedEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'first_name' })
  firstName: string;

  @Column({ name: 'last_name' })
  lastName: string;

  @Column({ name: 'user_name', unique: true })
  userName: string;

  @Column({ unique: true })
  email: string;

  @Column({ name: 'phone_number', nullable: true })
  phoneNumber: string;

  @Column({ name: 'date_of_birth', nullable: true })
  dob: Date;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column()
  role: string;

  @Column({ name: 'password' })
  passwordHash: string;

  @BeforeInsert()
  async hashPassword() {
    if (this.passwordHash) {
      const salt = await bcrypt.genSalt(10)
      this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
    }
  }
}
