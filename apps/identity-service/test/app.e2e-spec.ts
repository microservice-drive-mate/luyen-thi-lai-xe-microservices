import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ApiResponseInterceptor } from '@repo/common';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { AdminController } from '../src/presentation/http/admin.controller';
import { AuthController } from '../src/presentation/http/auth.controller';
import { ChangeUserRoleUseCase } from '../src/application/use-cases/change-user-role/change-user-role.use-case';
import { ChangePasswordUseCase } from '../src/application/use-cases/change-password/change-password.use-case';
import { CreateIdentityUserUseCase } from '../src/application/use-cases/create-identity-user/create-identity-user.use-case';
import { DeleteIdentityUserUseCase } from '../src/application/use-cases/delete-identity-user/delete-identity-user.use-case';
import { ForgotPasswordUseCase } from '../src/application/use-cases/forgot-password/forgot-password.use-case';
import { GetIdentityUserUseCase } from '../src/application/use-cases/get-identity-user/get-identity-user.use-case';
import { ListIdentityUsersUseCase } from '../src/application/use-cases/list-identity-users/list-identity-users.use-case';
import { LockUserUseCase } from '../src/application/use-cases/lock-user/lock-user.use-case';
import { LoginUseCase } from '../src/application/use-cases/login/login.use-case';
import { LogoutUseCase } from '../src/application/use-cases/logout/logout.use-case';
import { RefreshTokenUseCase } from '../src/application/use-cases/refresh-token/refresh-token.use-case';
import { ResetPasswordUseCase } from '../src/application/use-cases/reset-password/reset-password.use-case';
import { UpdateIdentityUserUseCase } from '../src/application/use-cases/update-identity-user/update-identity-user.use-case';

describe('Identity service HTTP contract (e2e smoke)', () => {
  let app: INestApplication;

  const loginUseCase = { execute: jest.fn() };
  const logoutUseCase = { execute: jest.fn() };
  const refreshTokenUseCase = { execute: jest.fn() };
  const forgotPasswordUseCase = { execute: jest.fn() };
  const resetPasswordUseCase = { execute: jest.fn() };
  const changePasswordUseCase = { execute: jest.fn() };
  const createIdentityUserUseCase = { execute: jest.fn() };
  const listIdentityUsersUseCase = { execute: jest.fn() };
  const getIdentityUserUseCase = { execute: jest.fn() };
  const updateIdentityUserUseCase = { execute: jest.fn() };
  const changeUserRoleUseCase = { execute: jest.fn() };
  const lockUserUseCase = { execute: jest.fn() };
  const deleteIdentityUserUseCase = { execute: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AuthController, AdminController],
      providers: [
        { provide: LoginUseCase, useValue: loginUseCase },
        { provide: LogoutUseCase, useValue: logoutUseCase },
        { provide: RefreshTokenUseCase, useValue: refreshTokenUseCase },
        { provide: ForgotPasswordUseCase, useValue: forgotPasswordUseCase },
        { provide: ResetPasswordUseCase, useValue: resetPasswordUseCase },
        { provide: ChangePasswordUseCase, useValue: changePasswordUseCase },
        {
          provide: CreateIdentityUserUseCase,
          useValue: createIdentityUserUseCase,
        },
        {
          provide: ListIdentityUsersUseCase,
          useValue: listIdentityUsersUseCase,
        },
        { provide: GetIdentityUserUseCase, useValue: getIdentityUserUseCase },
        {
          provide: UpdateIdentityUserUseCase,
          useValue: updateIdentityUserUseCase,
        },
        { provide: ChangeUserRoleUseCase, useValue: changeUserRoleUseCase },
        { provide: LockUserUseCase, useValue: lockUserUseCase },
        {
          provide: DeleteIdentityUserUseCase,
          useValue: deleteIdentityUserUseCase,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(
      (
        req: Request & { user?: unknown },
        _res: Response,
        next: NextFunction,
      ) => {
        req.user = { sub: req.header('x-user-id') ?? 'admin-1' };
        next();
      },
    );
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    app.useGlobalInterceptors(new ApiResponseInterceptor());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('POST /login returns token payload in the shared response envelope', async () => {
    loginUseCase.execute.mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresIn: 300,
      refreshExpiresIn: 1800,
      tokenType: 'Bearer',
      scope: 'openid profile',
    });

    await request(app.getHttpServer())
      .post('/login')
      .send({ username: 'student@test.com', password: '123456' })
      .expect(201)
      .expect((response) => {
        expect(response.body.success).toBe(true);
        expect(response.body.code).toBe('SUCCESS');
        expect(response.body.data.accessToken).toBe('access-token');
        expect(response.body.data.tokenType).toBe('Bearer');
      });
    expect(loginUseCase.execute).toHaveBeenCalledTimes(1);
  });

  it('POST /refresh delegates refresh-token flow', async () => {
    refreshTokenUseCase.execute.mockResolvedValue({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      expiresIn: 300,
      refreshExpiresIn: 1800,
      tokenType: 'Bearer',
    });

    await request(app.getHttpServer())
      .post('/refresh')
      .send({ refreshToken: 'refresh-token' })
      .expect(200)
      .expect((response) => {
        expect(response.body.data.refreshToken).toBe('new-refresh-token');
      });
    expect(refreshTokenUseCase.execute).toHaveBeenCalledTimes(1);
  });

  it('GET /admin/identity-users returns paginated identity users', async () => {
    listIdentityUsersUseCase.execute.mockResolvedValue({
      items: [
        {
          userId: 'user-1',
          email: 'student@test.com',
          fullName: 'Nguyen Van A',
          role: 'STUDENT',
          isActive: true,
          isDeleted: false,
          deletedAt: null,
          createdAt: new Date('2026-06-01T00:00:00.000Z'),
          updatedAt: new Date('2026-06-01T00:00:00.000Z'),
        },
      ],
      total: 1,
      page: 1,
      size: 20,
    });

    await request(app.getHttpServer())
      .get('/admin/identity-users')
      .expect(200)
      .expect((response) => {
        expect(response.body.data.total).toBe(1);
        expect(response.body.data.items[0]).toMatchObject({
          userId: 'user-1',
          email: 'student@test.com',
          role: 'STUDENT',
        });
      });
  });
});
