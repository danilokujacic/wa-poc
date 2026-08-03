import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UserRepository } from '../repository/user.repository';
import { UserRole } from '../entity/user.entity';
import { EmailConfirmationService } from '../email-confirmation/email-confirmation.service';

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: {
    findByEmail: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let jwtService: { sign: jest.Mock };
  let emailConfirmationService: { createAndSend: jest.Mock };

  beforeEach(async () => {
    userRepository = {
      findByEmail: jest.fn(),
      create: jest.fn((dto: object) => dto),
      save: jest.fn((entity: object) => ({ id: 'user-1', ...entity })),
    };
    jwtService = {
      sign: jest.fn().mockReturnValue('signed-token'),
    };
    emailConfirmationService = {
      createAndSend: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserRepository, useValue: userRepository },
        { provide: JwtService, useValue: jwtService },
        {
          provide: EmailConfirmationService,
          useValue: emailConfirmationService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('registers a new user as owner', async () => {
    userRepository.findByEmail.mockResolvedValue(null);

    const result = await service.register({
      name: 'Jane Doe',
      email: 'jane@example.com',
      password: 'password123',
    });

    expect(userRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'jane@example.com',
        role: UserRole.OWNER,
      }),
    );
    expect(result.accessToken).toBe('signed-token');
    expect(result.user.email).toBe('jane@example.com');
  });

  it('rejects registration when the email is already taken', async () => {
    userRepository.findByEmail.mockResolvedValue({ id: 'existing' });

    await expect(
      service.register({
        name: 'Jane Doe',
        email: 'jane@example.com',
        password: 'password123',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('logs in with valid credentials', async () => {
    const hashedPassword = await bcrypt.hash('password123', 1);
    userRepository.findByEmail.mockResolvedValue({
      id: 'user-1',
      name: 'Jane Doe',
      email: 'jane@example.com',
      password: hashedPassword,
      role: UserRole.OWNER,
    });

    const result = await service.login({
      email: 'jane@example.com',
      password: 'password123',
    });

    expect(result.accessToken).toBe('signed-token');
    expect(result.user.email).toBe('jane@example.com');
  });

  it('rejects login with an unknown email', async () => {
    userRepository.findByEmail.mockResolvedValue(null);

    await expect(
      service.login({ email: 'missing@example.com', password: 'password123' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects login with an invalid password', async () => {
    const hashedPassword = await bcrypt.hash('password123', 1);
    userRepository.findByEmail.mockResolvedValue({
      id: 'user-1',
      name: 'Jane Doe',
      email: 'jane@example.com',
      password: hashedPassword,
      role: UserRole.OWNER,
    });

    await expect(
      service.login({ email: 'jane@example.com', password: 'wrong-password' }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
