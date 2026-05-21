import { Test, type TestingModule } from '@nestjs/testing';
import { AuthController } from './presentation/http/auth.controller';
import { AppService } from './app.service';

describe('AuthController', () => {
  let authController: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AppService,
          useValue: {
            login: jest.fn(),
            logout: jest.fn(),
            refreshToken: jest.fn(),
          },
        },
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
