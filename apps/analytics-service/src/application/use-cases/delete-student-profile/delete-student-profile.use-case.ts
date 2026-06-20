import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import { LearningProgressRepository } from '../../../domain/repositories/learning-progress.repository';
import { DeleteStudentProfileCommand } from './delete-student-profile.command';

@Injectable()
export class DeleteStudentProfileUseCase
  implements IUseCase<DeleteStudentProfileCommand, void>
{
  constructor(private readonly repository: LearningProgressRepository) {}

  async execute(command: DeleteStudentProfileCommand): Promise<void> {
    await this.repository.deleteStudent(command.studentId);
  }
}
