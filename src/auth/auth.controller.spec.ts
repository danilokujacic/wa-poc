import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ACCESS_TOKEN_COOKIE } from './auth.constants';

describe('AuthController', () => {
  let controller: AuthController;
  let service: { register: jest.Mock; login: jest.Mock };
  let jwtService: { decode: jest.Mock };
  let response: { cookie: jest.Mock; clearCookie: jest.Mock };

  beforeEach(async () => {
    service = {
      register: jest.fn(),
      login: jest.fn(),
    };
    jwtService = {
      decode: jest
        .fn()
        .mockReturnValue({ exp: Math.floor(Date.now() / 1000) + 3600 }),
    };
    response = {
      cookie: jest.fn(),
      clearCookie: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: service },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('registers, sets the auth cookie and omits the token from the body', async () => {
    const dto = {
      name: 'Jane Doe',
      email: 'jane@example.com',
      password: 'password123',
    };
    const user = {
      id: 'user-1',
      name: 'Jane Doe',
      email: 'jane@example.com',
      role: 'Owner',
      emailConfirmed: false,
      resort: null,
    };
    service.register.mockResolvedValue({ accessToken: 'signed-token', user });

    const result = await controller.register(dto, response as any);

    expect(service.register).toHaveBeenCalledWith(dto);
    expect(response.cookie).toHaveBeenCalledWith(
      ACCESS_TOKEN_COOKIE,
      'signed-token',
      expect.objectContaining({ httpOnly: true, sameSite: 'lax' }),
    );
    expect(result).toEqual({
      user: {
        id: 'user-1',
        name: 'Jane Doe',
        email: 'jane@example.com',
        role: 'Owner',
        emailConfirmed: false,
        resort: null,
      },
    });
  });

  it('logs in, sets the auth cookie and omits the token from the body', async () => {
    const dto = { email: 'jane@example.com', password: 'password123' };
    const user = {
      id: 'user-1',
      name: 'Jane Doe',
      email: 'jane@example.com',
      role: 'Owner',
      emailConfirmed: true,
      resort: null,
    };
    service.login.mockResolvedValue({ accessToken: 'signed-token', user });

    const result = await controller.login(dto, response as any);

    expect(service.login).toHaveBeenCalledWith(dto);
    expect(response.cookie).toHaveBeenCalledWith(
      ACCESS_TOKEN_COOKIE,
      'signed-token',
      expect.objectContaining({ httpOnly: true, sameSite: 'lax' }),
    );
    expect(result).toEqual({
      user: {
        id: 'user-1',
        name: 'Jane Doe',
        email: 'jane@example.com',
        role: 'Owner',
        emailConfirmed: true,
        resort: null,
      },
    });
  });

  it('clears the auth cookie on logout', () => {
    const result = controller.logout(response as any);

    expect(response.clearCookie).toHaveBeenCalledWith(ACCESS_TOKEN_COOKIE, {
      path: '/',
    });
    expect(result).toEqual({ loggedOut: true });
  });
});
