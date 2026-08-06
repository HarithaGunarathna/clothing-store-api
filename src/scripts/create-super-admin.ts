/**
 * Creates an administrator account from the command line.
 *
 *   npm run admin:create -- --username=boss --email=boss@example.com --password='S3cret!'
 *
 * This bootstraps the *first* super admin. After that, administrators are made
 * through `POST /api/v1/admin/create-admin`, which requires an existing super
 * admin — so the very first one has to come from somewhere the API cannot
 * reach. Self-registration only ever creates buyers.
 *
 * The row is saved through the User repository rather than raw SQL so the
 * entity's `@BeforeInsert()` hook hashes the password with the same bcrypt cost
 * the login path verifies against. Inserting directly with SQL skips that hook
 * and stores the password in clear, producing an account that can never sign in.
 */
import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { config } from 'dotenv';
import { AppModule } from '../app.module';
import { User } from '../user/model/user.entity';
import { ADMIN_ROLES, Role } from '../constants/role.enum';
import { MIN_PASSWORD_LENGTH } from '../constants/password.constants';

config();

interface Args {
  username?: string;
  password?: string;
  email?: string;
  'first-name'?: string;
  'last-name'?: string;
  role?: string;
  help?: string;
}

/** Supports `--key=value` and `--key value`. */
function parseArgs(argv: string[]): Args {
  const args: Record<string, string> = {};

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;

    const withoutDashes = token.slice(2);
    const equals = withoutDashes.indexOf('=');

    if (equals !== -1) {
      args[withoutDashes.slice(0, equals)] = withoutDashes.slice(equals + 1);
    } else {
      const next = argv[i + 1];
      args[withoutDashes] = next && !next.startsWith('--') ? next : 'true';
      if (next && !next.startsWith('--')) i++;
    }
  }

  return args;
}

const USAGE = `
Create an administrator account.

  npm run admin:create -- --username=boss --email=boss@example.com --password='…'

Required
  --username        Sign-in name. Must be unique.
  --email           Must be unique.
  --password        At least ${MIN_PASSWORD_LENGTH} characters. May instead be
                    supplied as the ADMIN_PASSWORD environment variable, which
                    keeps it out of your shell history.

Optional
  --role            super_admin (default) or admin.
  --first-name      Defaults to the username.
  --last-name       Defaults to empty.

The account signs in at POST /auth/admin/login. Administrators have no Google or
Facebook sign-in, so this password is the only way in — there is no reset flow.
`;

function fail(message: string): never {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(USAGE);
    return;
  }

  const username = args.username?.trim();
  const email = args.email?.trim().toLowerCase();
  // The env var exists so the password need not appear in shell history.
  const password = args.password ?? process.env.ADMIN_PASSWORD;
  const role = args.role ?? Role.SuperAdmin;

  if (!username || !email || !password) {
    fail(
      'Missing --username, --email or --password. Run with --help for usage.',
    );
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    fail(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  if (!ADMIN_ROLES.includes(role)) {
    fail(`--role must be one of: ${ADMIN_ROLES.join(', ')}`);
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error'],
  });

  try {
    const users: Repository<User> = app.get(getRepositoryToken(User));

    // Checked up front so the failure is a readable message rather than a
    // unique-constraint violation.
    const clash = await users
      .createQueryBuilder('user')
      .where('user.user_name = :username', { username })
      .orWhere('user.email = :email', { email })
      .getOne();

    if (clash) {
      fail(
        clash.userName === username
          ? `The username "${username}" is already taken.`
          : `The email "${email}" already belongs to another account. ` +
              `To promote it instead: UPDATE users SET role = '${role}' WHERE email = '${email}';`,
      );
    }

    // create + save, so @BeforeInsert() hashes the password.
    const admin = await users.save(
      users.create({
        userName: username,
        email,
        firstName: args['first-name'] ?? username,
        lastName: args['last-name'] ?? '',
        role,
        emailVerified: true,
        isActive: true,
        passwordHash: password,
      }),
    );

    console.log(
      `\n  Created ${role} "${username}" (id ${admin.id}, ${email}).` +
        '\n  Sign in at POST /auth/admin/login.\n',
    );
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
