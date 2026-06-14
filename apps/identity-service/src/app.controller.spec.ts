import { Test, type TestingModule } from '@nestjs/testing';
import { ChangePasswordUseCase } from './application/use-cases/change-password/change-password.use-case';
import { ForgotPasswordUseCase } from './application/use-cases/forgot-password/forgot-password.use-case';
import { LoginUseCase } from './application/use-cases/login/login.use-case';
import { LogoutUseCase } from './application/use-cases/logout/logout.use-case';
import { RefreshTokenUseCase } from './application/use-cases/refresh-token/refresh-token.use-case';
import { ResetPasswordUseCase } from './application/use-cases/reset-password/reset-password.use-case';
import { AuthController } from './presentation/http/auth.controller';

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
        { provide: ResetPasswordUseCase, useValue: { execute: jest.fn() } },
        { provide: ChangePasswordUseCase, useValue: { execute: jest.fn() } },
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
