import { Injectable, UnauthorizedException } from '@nestjs/common';
import { NewUserDTO } from 'src/user/dto/createUserDTO';
import { ProviderProfileDTO } from 'src/user/dto/providerProfileDTO';
import { User } from './model/user.entity';
import { UserIdentity } from './model/user-identity.entity';
import { Address } from './model/address.entity';
import { DataSource, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { ADMIN_ROLES, isAdminRole, Role } from 'src/constants/role.enum';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserIdentity)
    private readonly identityRepository: Repository<UserIdentity>,
    @InjectRepository(Address)
    private readonly addressRepository: Repository<Address>,
    private readonly dataSource: DataSource,
  ) {}

  async createUser(newUserDTO: NewUserDTO) {
    const newUser = {
      userName: newUserDTO.userName,
      email: newUserDTO.email,
      firstName: newUserDTO.firstName,
      lastName: newUserDTO.lastName,
      phoneNumber: newUserDTO.phoneNumber || undefined,
      dob: newUserDTO.dob || undefined,
      // Always a buyer. Never read a role off the request — see NewUserDTO.
      role: Role.Buyer,
      passwordHash: newUserDTO.password,
    };
    const user = this.userRepository.create(newUser);
    await this.userRepository.save(user);
    return user;
  }

  async findUserByUsername(userName: string) {
    return this.userRepository.findOne({ where: { userName: userName } });
  }

  async findUserById(id: number) {
    return this.userRepository.findOne({ where: { id: id } });
  }

  async findUserByEmail(email: string) {
    return this.userRepository.findOne({ where: { email: email } });
  }

  /**
   * Administrator accounts are password-only, so no social flow may resolve to
   * one — neither by linking a new identity nor by using an existing link.
   *
   * Saying so plainly is safe here: reaching this point means the caller has
   * already authenticated with the provider for that email, so they own the
   * mailbox and learn nothing they could not confirm anyway.
   */
  private refuseSocialForAdmin(user: User): void {
    if (isAdminRole(user.role)) {
      throw new UnauthorizedException(
        'Administrator accounts sign in with a username and password.',
      );
    }
  }

  /** Used by admin creation to report a clash before the insert fails. */
  async findByUsernameOrEmail(
    userName: string,
    email: string,
  ): Promise<User | null> {
    return this.userRepository
      .createQueryBuilder('user')
      .where('user.user_name = :userName', { userName })
      .orWhere('user.email = :email', { email })
      .getOne();
  }

  /**
   * Creates an administrator. Separate from `createUser`, which forces
   * Role.Buyer because it backs public self-registration.
   */
  async createAdmin(input: {
    userName: string;
    email: string;
    password: string;
    firstName: string | null;
    lastName: string | null;
    phoneNumber: string | null;
    role: Role;
  }): Promise<User> {
    // create + save so @BeforeInsert() hashes the password.
    return this.userRepository.save(
      this.userRepository.create({
        userName: input.userName,
        email: input.email,
        firstName: input.firstName ?? undefined,
        lastName: input.lastName ?? undefined,
        phoneNumber: input.phoneNumber ?? undefined,
        role: input.role,
        emailVerified: true,
        isActive: true,
        passwordHash: input.password,
      }),
    );
  }

  async countActiveByRole(role: Role): Promise<number> {
    return this.userRepository.count({ where: { role, isActive: true } });
  }

  async setActive(userId: number, isActive: boolean): Promise<void> {
    await this.userRepository.update({ id: userId }, { isActive });
  }

  /** Every elevated account, newest first. Safe columns only. */
  async findAdmins(): Promise<User[]> {
    return this.userRepository.find({
      where: ADMIN_ROLES.map((role) => ({ role })),
      select: {
        id: true,
        firstName: true,
        lastName: true,
        userName: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      order: { createdAt: 'DESC' },
    });
  }

  /** The user with their linked providers — what /auth/me renders. */
  async findUserWithIdentities(id: number) {
    return this.userRepository.findOne({
      where: { id: id },
      relations: { identities: true },
    });
  }

  /**
   * The user's default billing and delivery addresses.
   *
   * At most two rows come back, and possibly one: a single address may carry
   * both flags, since the partial unique indexes cap each flag independently
   * rather than jointly.
   */
  async findDefaultAddresses(userId: number): Promise<Address[]> {
    return this.addressRepository
      .createQueryBuilder('address')
      .where('address.user_id = :userId', { userId })
      .andWhere('(address.is_default_billing OR address.is_default_shipping)')
      .getMany();
  }

  /**
   * Resolves a verified provider profile to a local user, in order:
   *   1. an existing identity for (provider, sub);
   *   2. an existing user with the same email — but only when the provider
   *      asserts the email is verified, otherwise anyone able to register an
   *      account with someone else's unverified address could take it over;
   *   3. a newly provisioned user, with no username and no password.
   */
  async findOrCreateFromProvider(profile: ProviderProfileDTO): Promise<User> {
    const existingIdentity = await this.identityRepository.findOne({
      where: {
        provider: profile.provider,
        providerUserId: profile.providerUserId,
      },
      relations: { user: true },
    });

    if (existingIdentity) {
      // Covers a link made before this rule existed.
      this.refuseSocialForAdmin(existingIdentity.user);
      return existingIdentity.user;
    }

    return this.dataSource.transaction(async (manager) => {
      let user: User | null = null;

      const userWithSameEmail = await manager.findOne(User, {
        where: { email: profile.email },
      });

      if (userWithSameEmail) {
        // Administrators sign in with a password only. Without this, an admin
        // whose email matches a Google or Facebook account would get a full
        // admin session through the social flow — bypassing the separate admin
        // sign-in entirely.
        this.refuseSocialForAdmin(userWithSameEmail);
      }

      if (profile.emailVerified) {
        user = userWithSameEmail;
      } else if (userWithSameEmail) {
        // Refuse rather than let the insert fail on the unique email
        // constraint — and never link, since the provider has not
        // vouched for this address.
        throw new UnauthorizedException(
          'That email is already registered. Sign in with your password first.',
        );
      }

      if (!user) {
        const created = manager.create(User, {
          userName: null,
          email: profile.email,
          emailVerified: profile.emailVerified,
          firstName: profile.firstName ?? '',
          lastName: profile.lastName ?? '',
          role: Role.Buyer,
          passwordHash: null,
        });
        user = await manager.save(User, created);
      } else if (!user.emailVerified && profile.emailVerified) {
        user.emailVerified = true;
        user = await manager.save(User, user);
      }

      const identity = manager.create(UserIdentity, {
        userId: user.id,
        provider: profile.provider,
        providerUserId: profile.providerUserId,
        email: profile.email,
      });
      await manager.save(UserIdentity, identity);

      return user;
    });
  }

  /**
   * Explicit column list, not `find()`. Selecting the whole entity returns
   * `password` — this endpoint was handing every caller a table of bcrypt
   * hashes. No endpoint should return that column, guarded or not.
   */
  async getAllUsers() {
    return this.userRepository.find({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        userName: true,
        email: true,
        emailVerified: true,
        phoneNumber: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });
  }
}
