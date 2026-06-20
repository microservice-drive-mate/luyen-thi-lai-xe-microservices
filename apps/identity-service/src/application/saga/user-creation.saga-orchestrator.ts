import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { resilientFetch } from '@repo/common';
import { IdentityUser } from '../../domain/aggregates/identity-user/identity-user.aggregate';
import { IdentityUserRepository } from '../../domain/repositories/identity-user.repository';
import { IdentityProviderPort } from '../ports/identity-provider.port';
import { PrismaService } from '../../infrastructure/persistence/prisma/prisma.service';

@Injectable()
export class UserCreationSagaOrchestrator {
  private readonly logger = new Logger(UserCreationSagaOrchestrator.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly identityProvider: IdentityProviderPort,
    private readonly identityUserRepository: IdentityUserRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(params: {
    email: string;
    fullName: string;
    role: string;
    password?: string;
  }): Promise<string> {
    const userRole = params.role as any;
    const temporaryPassword = params.password ?? 'Pass123!';

    // Step 1: Create user in Keycloak (and assign role)
    const userId = await this.identityProvider.createUser(
      params.email,
      temporaryPassword,
      params.fullName,
    );
    await this.identityProvider.assignRealmRole(userId, userRole);
    this.logger.log(
      `Step 1: Keycloak user created successfully with ID ${userId}`,
    );

    // Initialize Saga State and local IdentityUser
    await this.prisma.sagaState.create({
      data: {
        sagaName: 'USER_CREATION_SAGA',
        sagaId: userId,
        status: 'STARTED',
        payload: {
          email: params.email,
          fullName: params.fullName,
          role: params.role,
        },
      },
    });

    const user = IdentityUser.create({
      id: userId,
      email: params.email,
      fullName: params.fullName,
      role: userRole,
    });
    await this.identityUserRepository.save(user);

    const serviceToken = await this.identityProvider.getServiceToken();

    // Step 2: Create User Profile in user-service via HTTP
    try {
      const userServiceUrl =
        this.configService.get<string>('services.user.baseUrl') ??
        'http://localhost:3002';
      this.logger.log(
        `Step 2: Creating user profile at ${userServiceUrl}/admin/users`,
      );

      const response = await resilientFetch(
        `${userServiceUrl}/admin/users`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${serviceToken}`,
          },
          body: JSON.stringify({
            id: userId,
            email: params.email,
            fullName: params.fullName,
            role: params.role,
          }),
        },
        {
          serviceName: 'identity-service',
          dependencyName: 'user-service',
          timeoutMs: 5000,
        },
      );

      if (!response.ok) {
        throw new Error(`User-service returned status ${response.status}`);
      }

      await this.prisma.sagaState.update({
        where: { sagaId: userId },
        data: { status: 'PROFILE_CREATED' },
      });
      this.logger.log(
        `Step 2 succeeded: User profile created for ID ${userId}`,
      );
    } catch (error) {
      this.logger.error(
        `Step 2 failed: ${(error as Error).message}. Triggering compensation...`,
      );
      await this.rollback(userId, 'STARTED');
      throw new Error(
        `Saga User Creation Failed at User Profile Step: ${(error as Error).message}`,
      );
    }

    // Step 3: Create Student Learning Profile in analytics-service (only if role is STUDENT)
    if (params.role === 'STUDENT') {
      try {
        const analyticsServiceUrl =
          this.configService.get<string>('services.analytics.baseUrl') ??
          'http://localhost:3007';
        this.logger.log(
          `Step 3: Creating student learning profile at ${analyticsServiceUrl}/admin/analytics/students`,
        );

        const response = await resilientFetch(
          `${analyticsServiceUrl}/admin/analytics/students`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${serviceToken}`,
            },
            body: JSON.stringify({ studentId: userId }),
          },
          {
            serviceName: 'identity-service',
            dependencyName: 'analytics-service',
            timeoutMs: 5000,
          },
        );

        if (!response.ok) {
          throw new Error(
            `Analytics-service returned status ${response.status}`,
          );
        }

        this.logger.log(
          `Step 3 succeeded: Student learning profile created for ID ${userId}`,
        );
      } catch (error) {
        this.logger.error(
          `Step 3 failed: ${(error as Error).message}. Triggering compensation...`,
        );
        await this.rollback(userId, 'PROFILE_CREATED');
        throw new Error(
          `Saga User Creation Failed at Analytics Profile Step: ${(error as Error).message}`,
        );
      }
    }

    // Finalize Saga
    await this.prisma.sagaState.update({
      where: { sagaId: userId },
      data: { status: 'COMPLETED' },
    });

    // Mark user active locally
    const activeUser = await this.identityUserRepository.findById(userId);
    if (activeUser) {
      // Directly execute prisma update to set status to ACTIVE
      await this.prisma.identityUser.update({
        where: { id: userId },
        data: { status: 'ACTIVE' },
      });
    }

    this.logger.log(
      `Saga User Creation completed successfully for user ID ${userId}`,
    );
    return userId;
  }

  private async rollback(
    userId: string,
    currentSagaStatus: string,
  ): Promise<void> {
    this.logger.log(
      `Compensating saga status: ${currentSagaStatus} for user ID ${userId}`,
    );

    await this.prisma.sagaState.update({
      where: { sagaId: userId },
      data: { status: 'FAILED' },
    });

    const serviceToken = await this.identityProvider.getServiceToken();

    // Rollback Step 2: Delete User Profile (if it was created)
    if (currentSagaStatus === 'PROFILE_CREATED') {
      try {
        const userServiceUrl =
          this.configService.get<string>('services.user.baseUrl') ??
          'http://localhost:3002';
        this.logger.log(
          `Rollback Step 2: Deleting user profile in user-service`,
        );
        await resilientFetch(
          `${userServiceUrl}/admin/users/${userId}`,
          {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${serviceToken}`,
            },
          },
          {
            serviceName: 'identity-service',
            dependencyName: 'user-service',
            timeoutMs: 5000,
          },
        );
      } catch (err) {
        this.logger.error(`Rollback Step 2 failed: ${(err as Error).message}`);
      }
    }

    // Rollback Step 1: Delete Keycloak user
    try {
      this.logger.log(`Rollback Step 1: Deleting user in Keycloak`);
      await this.identityProvider.deleteUser(userId);
    } catch (err) {
      this.logger.error(`Rollback Step 1 failed: ${(err as Error).message}`);
    }

    // Mark user as failed locally
    try {
      await this.prisma.identityUser.update({
        where: { id: userId },
        data: { status: 'CREATION_FAILED' },
      });
    } catch (err) {
      this.logger.error(
        `Failed to update local user status to CREATION_FAILED: ${(err as Error).message}`,
      );
    }

    await this.prisma.sagaState.update({
      where: { sagaId: userId },
      data: { status: 'ROLLBACKED' },
    });

    this.logger.log(`Rollback completed for user ID ${userId}`);
  }
}
