import { ApiProperty } from '@nestjs/swagger';
import { ROLES } from 'src/constants/role.enum';

export class AddressDTO {
  @ApiProperty({ example: 3 })
  id: number;

  @ApiProperty({ example: 'Home', nullable: true })
  label: string | null;

  @ApiProperty({ example: '221B Galle Road' })
  line1: string;

  @ApiProperty({ example: null, nullable: true })
  line2: string | null;

  @ApiProperty({ example: 'Colombo' })
  city: string;

  @ApiProperty({ example: '00300', nullable: true })
  postalCode: string | null;

  @ApiProperty({ example: 'LK' })
  country: string;

  @ApiProperty({ example: '0771234567', nullable: true })
  phone: string | null;
}

/** The signed-in user's own profile. Never carries the password hash. */
export class MeResponseDTO {
  @ApiProperty({ example: 12 })
  id: number;

  @ApiProperty({ example: 'Jane', nullable: true })
  firstName: string | null;

  @ApiProperty({ example: 'Doe', nullable: true })
  lastName: string | null;

  @ApiProperty({
    example: 'janedoe',
    nullable: true,
    description: 'Null for accounts created through Google or Facebook.',
  })
  userName: string | null;

  @ApiProperty({ example: 'jane@example.com' })
  email: string;

  @ApiProperty({ example: true })
  emailVerified: boolean;

  @ApiProperty({ example: '0771234567', nullable: true })
  phoneNumber: string | null;

  @ApiProperty({ example: '1995-06-15', nullable: true })
  dob: string | null;

  @ApiProperty({ example: 'buyer', enum: ROLES })
  role: string;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: '2026-07-01T09:12:44.000Z' })
  createdAt: Date;

  @ApiProperty({
    example: true,
    description:
      'False for social-only accounts. Drives whether the profile page offers ' +
      '"Change password" or "Set a password".',
  })
  hasPassword: boolean;

  @ApiProperty({
    example: ['google'],
    isArray: true,
    type: String,
    description: 'Linked identity providers; empty for password-only accounts.',
  })
  connectedProviders: string[];

  @ApiProperty({
    type: AddressDTO,
    nullable: true,
    description: 'Null until the user saves one.',
  })
  defaultBillingAddress: AddressDTO | null;

  @ApiProperty({
    type: AddressDTO,
    nullable: true,
    description:
      'Null until the user saves one. May be the same address row as ' +
      'defaultBillingAddress — one address can be flagged as both.',
  })
  defaultDeliveryAddress: AddressDTO | null;
}
