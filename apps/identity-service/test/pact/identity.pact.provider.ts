import fs from 'node:fs';
import path from 'node:path';
import {
  ConflictException,
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { VerifierOptions } from '@pact-foundation/pact';
import { Verifier } from '@pact-foundation/pact';
import { ApiExceptionFilter, ApiResponseInterceptor } from '@repo/common';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ChangePasswordUseCase } from '../../src/application/use-cases/change-password/change-password.use-case';
import { ChangeUserRoleUseCase } from '../../src/application/use-cases/change-user-role/change-user-role.use-case';
import { CreateIdentityUserUseCase } from '../../src/application/use-cases/create-identity-user/create-identity-user.use-case';
import { DeleteIdentityUserUseCase } from '../../src/application/use-cases/delete-identity-user/delete-identity-user.use-case';
import { ForgotPasswordUseCase } from '../../src/application/use-cases/forgot-password/forgot-password.use-case';
import { GetIdentityUserUseCase } from '../../src/application/use-cases/get-identity-user/get-identity-user.use-case';
import { ListIdentityUsersUseCase } from '../../src/application/use-cases/list-identity-users/list-identity-users.use-case';
import { LockUserUseCase } from '../../src/application/use-cases/lock-user/lock-user.use-case';
import { LoginUseCase } from '../../src/application/use-cases/login/login.use-case';
import { LogoutUseCase } from '../../src/application/use-cases/logout/logout.use-case';
import { RefreshTokenUseCase } from '../../src/application/use-cases/refresh-token/refresh-token.use-case';
import { ResetPasswordUseCase } from '../../src/application/use-cases/reset-password/reset-password.use-case';
import { UpdateIdentityUserUseCase } from '../../src/application/use-cases/update-identity-user/update-identity-user.use-case';
// IdentityUserNotFoundException is a DomainException — use it so DomainExceptionFilter
// exercises the same filter chain as production for the not-found error path.
import { IdentityUserNotFoundException } from '../../src/domain/exceptions/identity-user-not-found.exception';
import { DomainExceptionFilter } from '../../src/infrastructure/filters/domain-exception.filter';
import { AdminController } from '../../src/presentation/http/admin.controller';
import { AuthController } from '../../src/presentation/http/auth.controller';

type StateHandlers = NonNullable<VerifierOptions['stateHandlers']>;
type UseCaseMock = {
  execute: (...args: unknown[]) => Promise<unknown>;
  resolves: (value: unknown) => void;
  rejects: (error: unknown) => void;
};

const pactUserId = '550e8400-e29b-41d4-a716-446655440010';
const pactAdminId = '550e8400-e29b-41d4-a716-446655440100';
const pactNow = new Date('2026-06-01T00:00:00.000Z');

const expectedPactFiles = [
  'drivemate-mobile-identity-service.json',
  'drivemate-admin-identity-service.json',
];

function createUseCaseMock(): UseCaseMock {
  let handler = async (): Promise<unknown> => undefined;
  return {
    execute: (..._args: unknown[]) => handler(),
    resolves: (value: unknown) => {
      handler = async () => value;
    },
    rejects: (error: unknown) => {
      handler = async () => {
        throw error;
      };
    },
  };
}

const loginUseCase = createUseCaseMock();
const logoutUseCase = createUseCaseMock();
const refreshTokenUseCase = createUseCaseMock();
const forgotPasswordUseCase = createUseCaseMock();
const resetPasswordUseCase = createUseCaseMock();
const changePasswordUseCase = createUseCaseMock();
const createIdentityUserUseCase = createUseCaseMock();
const listIdentityUsersUseCase = createUseCaseMock();
const getIdentityUserUseCase = createUseCaseMock();
const updateIdentityUserUseCase = createUseCaseMock();
const changeUserRoleUseCase = createUseCaseMock();
const lockUserUseCase = createUseCaseMock();
const deleteIdentityUserUseCase = createUseCaseMock();

function resolvePactUrls(provider: string): string[] {
  if (process.env.PACT_URLS) {
    return process.env.PACT_URLS.split(',')
      .map((url) => url.trim())
      .filter(Boolean)
      .map((url) => path.resolve(url));
  }

  const pactDir = path.resolve(
    process.env.PACT_DIR ?? path.resolve(__dirname, '../../../../pacts'),
  );
  const expectedUrls = expectedPactFiles
    .map((fileName) => path.join(pactDir, fileName))
    .filter((filePath) => fs.existsSync(filePath));
  const discoveredUrls = fs.existsSync(pactDir)
    ? fs
        .readdirSync(pactDir)
        .filter(
          (fileName) =>
            fileName.endsWith('.json') && fileName.includes(provider),
        )
        .map((fileName) => path.join(pactDir, fileName))
    : [];

  const pactUrls = Array.from(new Set([...expectedUrls, ...discoveredUrls]));
  if (pactUrls.length > 0 || process.env.PACT_SKIP_MISSING === 'true') {
    return pactUrls;
  }

  throw new Error(
    [
      `No pact files found for ${provider}.`,
      `Expected files in ${pactDir}: ${expectedPactFiles.join(', ')}`,
      'Set PACT_DIR, PACT_URLS, or PACT_SKIP_MISSING=true for a dry local run.',
    ].join(' '),
  );
}

function identityUser(overrides = {}) {
  return {
    userId: pactUserId,
    email: 'student@example.com',
    fullName: 'Nguyen Van A',
    role: 'STUDENT',
    isActive: true,
    isDeleted: false,
    deletedAt: null,
    createdAt: pactNow,
    updatedAt: pactNow,
    ...overrides,
  };
}

function tokenResponse(overrides = {}) {
  return {
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    expiresIn: 300,
    refreshExpiresIn: 1800,
    tokenType: 'Bearer',
    scope: 'openid profile email',
    ...overrides,
  };
}

function arrangeDefaultProviderState() {
  loginUseCase.resolves(tokenResponse());
  refreshTokenUseCase.resolves(
    tokenResponse({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
    }),
  );
  logoutUseCase.resolves({
    success: true,
    message: 'You have been logged out successfully.',
    instruction: 'Please delete your token from LocalStorage or Cookie',
  });
  forgotPasswordUseCase.resolves({
    success: true,
    message:
      'If this email exists, password reset instructions have been sent.',
  });
  resetPasswordUseCase.resolves({
    success: true,
    message: 'Password action completed successfully.',
  });
  changePasswordUseCase.resolves({
    success: true,
    message: 'Password action completed successfully.',
  });
  createIdentityUserUseCase.resolves({
    userId: pactUserId,
    email: 'student@example.com',
    fullName: 'Nguyen Van A',
    role: 'STUDENT',
  });
  listIdentityUsersUseCase.resolves({
    items: [identityUser()],
    total: 1,
    page: 1,
    size: 20,
  });
  getIdentityUserUseCase.resolves(identityUser());
  updateIdentityUserUseCase.resolves(
    identityUser({
      email: 'updated-student@example.com',
      fullName: 'Nguyen Van B',
    }),
  );
  changeUserRoleUseCase.resolves({
    userId: pactUserId,
    role: 'INSTRUCTOR',
  });
  lockUserUseCase.resolves({
    userId: pactUserId,
    locked: true,
  });
  deleteIdentityUserUseCase.resolves(
    identityUser({
      isActive: false,
      isDeleted: true,
      deletedAt: pactNow,
    }),
  );
}

function providerValues() {
  return {
    adminId: pactAdminId,
    userId: pactUserId,
  };
}

function assignControllerDependencies<T extends object>(
  controller: T,
  dependencies: Record<string, unknown>,
) {
  Object.assign(controller, dependencies);
}

const defaultStateHandler = async () => {
  arrangeDefaultProviderState();
  return providerValues();
};

const stateHandlers: StateHandlers = {
  'a valid identity login exists': defaultStateHandler,
  'a valid refresh token exists': defaultStateHandler,
  'a logout token exists': defaultStateHandler,
  'an identity user can be created': defaultStateHandler,
  'identity users exist': defaultStateHandler,
  'an identity user exists': defaultStateHandler,
  'an identity user can be updated': defaultStateHandler,
  'an identity user can change role': defaultStateHandler,
  'an identity user can be locked': defaultStateHandler,
  'an identity user can be deleted': defaultStateHandler,
  'a password reset target exists': defaultStateHandler,
  'the current user can change password': defaultStateHandler,
  'identity login is rejected': async () => {
    arrangeDefaultProviderState();
    loginUseCase.rejects(
      new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Invalid credentials',
      }),
    );
    return providerValues();
  },
  'an identity user already exists': async () => {
    arrangeDefaultProviderState();
    createIdentityUserUseCase.rejects(
      new ConflictException({
        code: 'IDENTITY_USER_ALREADY_EXISTS',
        message: 'Identity user already exists',
      }),
    );
    return providerValues();
  },
  'an identity user does not exist': async () => {
    arrangeDefaultProviderState();
    // IdentityUserNotFoundException is a DomainException — DomainExceptionFilter maps
    // it to HTTP 404 with code IDENTITY_USER_NOT_FOUND, matching production behavior.
    // Constructor requires a userId arg (used in message); pact ID is fine here.
    getIdentityUserUseCase.rejects(
      new IdentityUserNotFoundException(pactUserId),
    );
    return providerValues();
  },
};

const injectPactAuth: RequestHandler = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  req.headers.authorization ??= 'Bearer pact-test-token';
  req.headers['x-user-id'] ??= pactAdminId;
  next();
};

async function createProviderApp(): Promise<{
  app: INestApplication;
  providerBaseUrl: string;
}> {
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

  assignControllerDependencies(moduleFixture.get(AuthController), {
    loginUseCase,
    logoutUseCase,
    refreshTokenUseCase,
    forgotPasswordUseCase,
    resetPasswordUseCase,
    changePasswordUseCase,
  });
  assignControllerDependencies(moduleFixture.get(AdminController), {
    createIdentityUserUseCase,
    listIdentityUsersUseCase,
    getIdentityUserUseCase,
    updateIdentityUserUseCase,
    changeUserRoleUseCase,
    lockUserUseCase,
    deleteIdentityUserUseCase,
  });

  const app = moduleFixture.createNestApplication();
  // AuthController is mounted at @Controller() (no prefix), but Kong routes
  // /auth/* → service. The Pact mock server receives /auth/* paths, so we
  // strip the /auth segment only for those routes; /admin/* must be unchanged.
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (req.url.startsWith('/auth/') || req.url === '/auth') {
      req.url = req.url.slice('/auth'.length) || '/';
    }
    next();
  });
  app.use(
    (req: Request & { user?: unknown }, _res: Response, next: NextFunction) => {
      req.user = { sub: req.header('x-user-id') ?? pactAdminId };
      next();
    },
  );
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  // Register both filters in the same order as production main.ts.
  // DomainExceptionFilter must come after ApiExceptionFilter so Nest applies
  // more-specific filters (DomainException) first.
  app.useGlobalFilters(new ApiExceptionFilter(), new DomainExceptionFilter());
  app.useGlobalInterceptors(new ApiResponseInterceptor());
  await app.listen(0, '127.0.0.1');
  return { app, providerBaseUrl: await app.getUrl() };
}

async function main() {
  const pactUrls = resolvePactUrls('identity-service');
  arrangeDefaultProviderState();
  const { app, providerBaseUrl } = await createProviderApp();
  try {
    if (pactUrls.length === 0) {
      console.log(
        'Skipping identity-service Pact verification because PACT_SKIP_MISSING=true and no pact files were found.',
      );
      return;
    }

    await new Verifier({
      provider: 'identity-service',
      providerBaseUrl,
      pactUrls,
      requestFilter: injectPactAuth,
      stateHandlers,
      beforeEach: async () => arrangeDefaultProviderState(),
      failIfNoPactsFound: true,
      logLevel: (process.env.PACT_LOG_LEVEL ??
        'info') as VerifierOptions['logLevel'],
    }).verifyProvider();
  } finally {
    await app.close();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
