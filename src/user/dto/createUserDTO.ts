export class NewUserDTO  {
  readonly userName: string;
  readonly email: string;
  readonly password: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly phoneNumber?: string;
  readonly dob?: Date;
  readonly role: string;
}