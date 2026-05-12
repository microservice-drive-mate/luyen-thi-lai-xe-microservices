import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { PrismaService } from '../../infrastructure/persistence/prisma/prisma.service';

interface StudentLicenseAssignedPayload {
  studentId: string;
  newTier: string;
  oldTier: string | null;
}

interface MediaFileDeletedPayload {
  fileId: string;
  storageKey: string;
  deletedById: string;
}

@Controller()
export class MessagingController {
  private readonly logger = new Logger(MessagingController.name);

  constructor(private readonly prisma: PrismaService) {}

  @EventPattern('user.student.license-assigned')
  handleStudentLicenseAssigned(
    @Payload() payload: StudentLicenseAssignedPayload,
  ): void {
    this.logger.log(
      `Received user.student.license-assigned for studentId=${payload.studentId}, newTier=${payload.newTier}`,
    );
  }

  @EventPattern('media.file.deleted')
  async handleMediaFileDeleted(
    @Payload() payload: MediaFileDeletedPayload,
  ): Promise<void> {
    this.logger.log(`Received media.file.deleted for fileId=${payload.fileId}`);
    try {
      // CourseMaterial is owned by Course aggregate; direct Prisma update is the
      // pragmatic choice here since there is no standalone CourseMaterialRepository.
      await this.prisma.courseMaterial.updateMany({
        where: { mediaFileId: payload.fileId },
        data: { fileUrl: null, mediaFileId: null },
      });
      this.logger.log(`Cleared materials referencing fileId=${payload.fileId}`);
    } catch (error) {
      this.logger.error(
        `Failed to handle media.file.deleted: ${(error as Error).message}`,
      );
    }
  }
}
