import { Injectable, UnauthorizedException } from '@nestjs/common';
import { NewUserDTO } from 'src/user/dto/createUserDTO';
import { ProviderProfileDTO } from 'src/user/dto/providerProfileDTO';
import { User } from './model/user.entity';
import { UserIdentity } from './model/user-identity.entity';
import { DataSource, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Role } from 'src/constants/role.enum';

@Injectable()
export class UserService {
    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        @InjectRepository(UserIdentity)
        private readonly identityRepository: Repository<UserIdentity>,
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
            role: newUserDTO.role,
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
            return existingIdentity.user;
        }

        return this.dataSource.transaction(async (manager) => {
            let user: User | null = null;

            const userWithSameEmail = await manager.findOne(User, {
                where: { email: profile.email },
            });

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

    async getAllUsers() {
        return this.userRepository.find();
    }
}
