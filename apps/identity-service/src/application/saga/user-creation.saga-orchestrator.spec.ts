import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { resilientFetch } from '@repo/common';
import { UserCreationSagaOrchestrator } from './user-creation.saga-orchestrator';
import { IdentityProviderPort } from '../ports/identity-provider.port';
import { IdentityUserRepository } from '../../domain/repositories/identity-user.repository';
import { PrismaService } from '../../infrastructure/persistence/prisma/prisma.service';

jest.mock('@repo/common', () => {
  const original = jest.requireActual('@repo/common');
  return {
    ...original,
    resilientFetch: jest.fn(),
  };
});

describe('UserCreationSagaOrchestrator', () => {
  let orchestrator: UserCreationSagaOrchestrator;
  let mockIdentityProvider: jest.Mocked<IdentityProviderPort>;
  let mockIdentityUserRepository: jest.Mocked<IdentityUserRepository>;
  let mockPrismaService: any;
  let mockConfigService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    mockIdentityProvider = {
      createUser: jest.fn().mockResolvedValue('test-user-id'),
      assignRealmRole: jest.fn().mockResolvedValue(undefined),
      deleteUser: jest.fn().mockResolvedValue(undefined),
      getServiceToken: jest.fn().mockResolvedValue('test-token'),
    } as any;

    mockIdentityUserRepository = {
      save: jest.fn().mockResolvedValue(undefined),
      findById: jest.fn().mockResolvedValue({
        id: 'test-user-id',
        email: 'test@example.com',
        fullName: 'Test User',
        role: 'STUDENT',
      } as any),
    } as any;

    mockPrismaService = {
      sagaState: {
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
      },
      identityUser: {
        update: jest.fn().mockResolvedValue({}),
      },
    };

    mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'services.user.baseUrl') return 'http://user-service';
        if (key === 'services.analytics.baseUrl')
          return 'http://analytics-service';
        return undefined;
      }),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserCreationSagaOrchestrator,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: IdentityProviderPort, useValue: mockIdentityProvider },
        {
          provide: IdentityUserRepository,
          useValue: mockIdentityUserRepository,
        },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    orchestrator = module.get<UserCreationSagaOrchestrator>(
      UserCreationSagaOrchestrator,
    );
    jest.clearAllMocks();
  });

  it('should complete user creation saga successfully for STUDENT role', async () => {
    (resilientFetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 201,
      json: jest.fn().mockResolvedValue({}),
    });

    const result = await orchestrator.execute({
      email: 'test@example.com',
      fullName: 'Test User',
      role: 'STUDENT',
      password: 'Password123!',
    });

    expect(result).toBe('test-user-id');
    expect(mockIdentityProvider.createUser).toHaveBeenCalledWith(
      'test@example.com',
      'Password123!',
      'Test User',
    );
    expect(mockIdentityProvider.assignRealmRole).toHaveBeenCalledWith(
      'test-user-id',
      'STUDENT',
    );
    expect(mockPrismaService.sagaState.create).toHaveBeenCalled();
    expect(mockIdentityUserRepository.save).toHaveBeenCalled();

    // Check that HTTP requests to both services were called
    expect(resilientFetch).toHaveBeenCalledTimes(2);
    expect(mockPrismaService.sagaState.update).toHaveBeenCalledWith({
      where: { sagaId: 'test-user-id' },
      data: { status: 'COMPLETED' },
    });
    expect(mockPrismaService.identityUser.update).toHaveBeenCalledWith({
      where: { id: 'test-user-id' },
      data: { status: 'ACTIVE' },
    });
  });

  it('should trigger rollback when user-service profile creation fails', async () => {
    // mock first resilientFetch failure
    (resilientFetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
    });

    await expect(
      orchestrator.execute({
        email: 'test@example.com',
        fullName: 'Test User',
        role: 'STUDENT',
        password: 'Password123!',
      }),
    ).rejects.toThrow('Saga User Creation Failed at User Profile Step');

    expect(mockPrismaService.sagaState.update).toHaveBeenCalledWith({
      where: { sagaId: 'test-user-id' },
      data: { status: 'FAILED' },
    });

    // Verify keycloak user is deleted as part of compensation
    expect(mockIdentityProvider.deleteUser).toHaveBeenCalledWith(
      'test-user-id',
    );

    // Verify Saga status updated to ROLLBACKED at the end
    expect(mockPrismaService.sagaState.update).toHaveBeenCalledWith({
      where: { sagaId: 'test-user-id' },
      data: { status: 'ROLLBACKED' },
    });
  });

  it('should trigger rollback of user-service profile and keycloak when analytics-service profile creation fails', async () => {
    // first fetch (user-service) succeeds, second fetch (analytics-service) fails
    (resilientFetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, status: 201 })
      .mockResolvedValueOnce({ ok: false, status: 500 });

    await expect(
      orchestrator.execute({
        email: 'test@example.com',
        fullName: 'Test User',
        role: 'STUDENT',
        password: 'Password123!',
      }),
    ).rejects.toThrow('Saga User Creation Failed at Analytics Profile Step');

    // Rollback deletes profile from user-service
    expect(resilientFetch).toHaveBeenNthCalledWith(
      3,
      'http://user-service/admin/users/test-user-id',
      expect.objectContaining({ method: 'DELETE' }),
      expect.any(Object),
    );

    // Rollback deletes keycloak user
    expect(mockIdentityProvider.deleteUser).toHaveBeenCalledWith(
      'test-user-id',
    );
  });
});
