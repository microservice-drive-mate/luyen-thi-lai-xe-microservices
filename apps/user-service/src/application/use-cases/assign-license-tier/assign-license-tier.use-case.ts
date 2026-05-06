import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import { UserProfileNotFoundException } from '../../../domain/exceptions/user-profile-not-found.exception';
import { UserProfileRepository } from '../../../domain/repositories/user-profile.repository';
import { EventPublisher } from '../../ports/event-publisher.port';
import { AssignLicenseTierCommand } from './assign-license-tier.command';

@Injectable()
export class AssignLicenseTierUseCase implements IUseCase<AssignLicenseTierCommand, void> {
  constructor(
    private readonly userProfileRepository: UserProfileRepository,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(command: AssignLicenseTierCommand): Promise<void> {
    const profile = await this.userProfileRepository.findById(command.studentId);
    if (!profile) {
      throw new UserProfileNotFoundException(command.studentId);
    }

    profile.assignLicenseTier(command.newLicenseTier, command.changedById);

    await this.userProfileRepository.save(profile);

    const events = profile.getDomainEvents();
    profile.clearDomainEvents();
    await this.eventPublisher.publishAll(events);
  }
}
