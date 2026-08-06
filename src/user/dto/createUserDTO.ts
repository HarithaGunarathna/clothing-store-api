/**
 * Registration only ever creates buyers, so there is deliberately no `role`
 * field: it was previously taken from the request body and stored as given,
 * which let anyone sign up as an admin. Elevating an account is an
 * administrative action, not something the applicant chooses.
 */
export class NewUserDTO {
  readonly userName: string;
  readonly email: string;
  readonly password: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly phoneNumber?: string;
  readonly dob?: Date;
}
