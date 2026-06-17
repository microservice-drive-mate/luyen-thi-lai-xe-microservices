import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ApiResponseInterceptor } from '@repo/common';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { AssignLicenseTierUseCase } from '../src/application/use-cases/assign-license-tier/assign-license-tier.use-case';
import { CreateUserDocumentUseCase } from '../src/application/use-cases/create-user-document/create-user-document.use-case';
import { CreateUserProfileUseCase } from '../src/application/use-cases/create-user-profile/create-user-profile.use-case';
import { GetUserProfileUseCase } from '../src/application/use-cases/get-user-profile/get-user-profile.use-case';
import { ListUserDocumentsUseCase } from '../src/application/use-cases/list-user-documents/list-user-documents.use-case';
import { ListUsersUseCase } from '../src/application/use-cases/list-users/list-users.use-case';
import { LockUserUseCase } from '../src/application/use-cases/lock-user/lock-user.use-case';
import { UpdateUserProfileUseCase } from '../src/application/use-cases/update-user-profile/update-user-profile.use-case';
import { AdminUserController } from '../src/presentation/http/admin-user.controller';
import { UserController } from '../src/presentation/http/user.controller';

describe('User service HTTP contract (e2e smoke)', () => {
  let app: INestApplication;

  const createUserProfileUseCase = { execute: jest.fn() };
  const updateUserProfileUseCase = { execute: jest.fn() };
  const getUserProfileUseCase = { execute: jest.fn() };
  const listUsersUseCase = { execute: jest.fn() };
  const lockUserUseCase = { execute: jest.fn() };
  const assignLicenseTierUseCase = { execute: jest.fn() };
  const createUserDocumentUseCase = { execute: jest.fn() };
  const listUserDocumentsUseCase = { execute: jest.fn() };

  const profile = {
    id: 'user-1',
    fullName: 'Nguyen Van A',
    email: 'student@test.com',
    phoneNumber: null,
    dateOfBirth: null,
    avatarUrl: null,
    mediaFileId: null,
    gender: null,
    address: null,
    role: 'STUDENT',
    isActive: true,
    createdAt: new Date('2026-06-01T00:00:00.000Z'),
    studentDetail: {
      licenseTier: 'B1',
      enrolledAt: new Date('2026-06-01T00:00:00.000Z'),
      notes: null,
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [UserController, AdminUserController],
      providers: [
        {
          provide: CreateUserProfileUseCase,
          useValue: createUserProfileUseCase,
        },
        {
          provide: UpdateUserProfileUseCase,
          useValue: updateUserProfileUseCase,
        },
        { provide: GetUserProfileUseCase, useValue: getUserProfileUseCase },
        { provide: ListUsersUseCase, useValue: listUsersUseCase },
        { provide: LockUserUseCase, useValue: lockUserUseCase },
        {
          provide: AssignLicenseTierUseCase,
          useValue: assignLicenseTierUseCase,
        },
        {
          provide: CreateUserDocumentUseCase,
          useValue: createUserDocumentUseCase,
        },
        {
          provide: ListUserDocumentsUseCase,
          useValue: listUserDocumentsUseCase,
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
        req.user = { sub: req.header('x-user-id') ?? 'user-1' };
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

  it('GET /users/me returns the current profile from authenticated context', async () => {
    getUserProfileUseCase.execute.mockResolvedValue(profile);

    await request(app.getHttpServer())
      .get('/users/me')
      .set('x-user-id', 'user-1')
      .expect(200)
      .expect((response) => {
        expect(response.body.data).toMatchObject({
          id: 'user-1',
          email: 'student@test.com',
          role: 'STUDENT',
        });
      });
    expect(getUserProfileUseCase.execute).toHaveBeenCalledTimes(1);
  });

  it('POST /admin/users creates a profile for an identity user', async () => {
    createUserProfileUseCase.execute.mockResolvedValue({
      id: 'user-2',
      fullName: 'Tran Thi B',
      email: 'student.b@test.com',
      role: 'STUDENT',
    });

    await request(app.getHttpServer())
      .post('/admin/users')
      .send({
        id: 'user-2',
        fullName: 'Tran Thi B',
        email: 'student.b@test.com',
        role: 'STUDENT',
        licenseTier: 'B1',
      })
      .expect(201)
      .expect((response) => {
        expect(response.body.message).toBe('Created');
        expect(response.body.data).toMatchObject({
          id: 'user-2',
          email: 'student.b@test.com',
        });
      });
    expect(createUserProfileUseCase.execute).toHaveBeenCalledTimes(1);
  });

  it('GET /admin/users returns paginated user profiles', async () => {
    listUsersUseCase.execute.mockResolvedValue({
      items: [profile],
      total: 1,
      page: 1,
      size: 20,
    });

    await request(app.getHttpServer())
      .get('/admin/users')
      .expect(200)
      .expect((response) => {
        expect(response.body.data.total).toBe(1);
        expect(response.body.data.items[0].studentDetail.licenseTier).toBe(
          'B1',
        );
      });
  });
});
