import { ApiProperty } from '@nestjs/swagger';
import { ADMIN_ROLES } from 'src/constants/role.enum';

/** Safe columns only — never the password hash. */
export class AdminSummaryDTO {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'boss', nullable: true })
  userName: string | null;

  @ApiProperty({ example: 'boss@example.com' })
  email: string;

  @ApiProperty({ example: 'Site', nullable: true })
  firstName: string | null;

  @ApiProperty({ example: 'Owner', nullable: true })
  lastName: string | null;

  @ApiProperty({ enum: ADMIN_ROLES, example: 'super_admin' })
  role: string;

  @ApiProperty({
    example: true,
    description: 'False once deactivated — the account cannot sign in.',
  })
  isActive: boolean;

  @ApiProperty({ example: '2026-07-01T09:12:44.000Z' })
  createdAt: Date;
}

export class AdminListDTO {
  @ApiProperty({ type: [AdminSummaryDTO] })
  admins: AdminSummaryDTO[];

  @ApiProperty({ example: 3 })
  total: number;
}

export class AdminDeactivatedDTO {
  @ApiProperty({ example: 42 })
  id: number;

  @ApiProperty({ example: 'olddesk', nullable: true })
  userName: string | null;

  @ApiProperty({ example: 'old@example.com' })
  email: string;

  @ApiProperty({
    example: 'admin',
    description: 'Unchanged — deactivating does not alter the role.',
  })
  role: string;

  @ApiProperty({ example: false })
  isActive: boolean;

  @ApiProperty({
    example: 2,
    description: 'Sessions ended by the deactivation, across all devices.',
  })
  sessionsRevoked: number;
}
