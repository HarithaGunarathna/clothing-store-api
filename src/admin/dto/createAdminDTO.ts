import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ADMIN_ROLES, Role } from 'src/constants/role.enum';
import { MIN_PASSWORD_LENGTH } from 'src/constants/password.constants';

export class CreateAdminDTO {
  @ApiProperty({
    example: 'newadmin',
    description: 'Sign-in name. Must be unique.',
  })
  readonly userName: string;

  @ApiProperty({
    example: 'newadmin@example.com',
    description: 'Must be unique.',
  })
  readonly email: string;

  @ApiProperty({
    example: 'pass12',
    description: `At least ${MIN_PASSWORD_LENGTH} characters. Hashed with bcrypt before storage.`,
  })
  readonly password: string;

  @ApiPropertyOptional({ example: 'New' })
  readonly firstName?: string;

  @ApiPropertyOptional({ example: 'Admin' })
  readonly lastName?: string;

  @ApiPropertyOptional({ example: 'admin' })
  readonly phoneNumber?: string;

  @ApiPropertyOptional({
    enum: ADMIN_ROLES,
    default: Role.Admin,
    description:
      'Defaults to admin. A super admin may also create another super_admin; ' +
      'buyer is rejected — use registration for those.',
  })
  readonly role?: string;
}

/** The created account. Never carries the password or its hash. */
export class AdminCreatedDTO {
  @ApiProperty({ example: 42 })
  id: number;

  @ApiProperty({ example: 'newadmin' })
  userName: string | null;

  @ApiProperty({ example: 'newadmin@example.com' })
  email: string;

  @ApiProperty({ example: 'New', nullable: true })
  firstName: string | null;

  @ApiProperty({ example: 'Admin', nullable: true })
  lastName: string | null;

  @ApiProperty({ enum: ADMIN_ROLES, example: 'admin' })
  role: string;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: '2026-08-06T18:17:56.193Z' })
  createdAt: Date;
}
