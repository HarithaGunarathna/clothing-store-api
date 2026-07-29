import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { GoogleService } from './google.service';
import { FacebookService } from './facebook.service';
import { RefreshTokenService } from './refresh-token.service';
import { UserService } from 'src/user/user.service';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserService, useValue: {} },
        { provide: JwtService, useValue: {} },
        { provide: RefreshTokenService, useValue: {} },
        { provide: GoogleService, useValue: { provider: 'google' } },
        { provide: FacebookService, useValue: { provider: 'facebook' } },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
