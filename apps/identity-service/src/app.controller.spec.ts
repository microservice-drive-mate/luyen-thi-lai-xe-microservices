import { Test, type TestingModule } from '@nestjs/testing';
import { AuthController } from './presentation/http/auth.controller';
import { ForgotPasswordUseCase } from './application/use-cases/forgot-password/forgot-password.use-case';
import { LoginUseCase } from './application/use-cases/login/login.use-case';
import { LogoutUseCase } from './application/use-cases/logout/logout.use-case';
import { RefreshTokenUseCase } from './application/use-cases/refresh-token/refresh-token.use-case';

describe('AuthController', () => {
  let authController: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: LoginUseCase, useValue: { execute: jest.fn() } },
        { provide: LogoutUseCase, useValue: { execute: jest.fn() } },
        { provide: RefreshTokenUseCase, useValue: { execute: jest.fn() } },
        { provide: ForgotPasswordUseCase, useValue: { execute: jest.fn() } },
      ],
    }).compile();

    authController = module.get<AuthController>(AuthController);
  });

  it('should return public message', () => {
    expect(authController.getPublic()).toEqual({
      message: 'Đây là API Public, ai cũng xem được!',
    });
  });
});
