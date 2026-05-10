import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';

interface StudentLicenseAssignedPayload {
  studentId: string;
  newTier: string;
  oldTier: string | null;
}

@Controller()
export class MessagingController {
  private readonly logger = new Logger(MessagingController.name);

  @EventPattern('user.student.license-assigned')
  handleStudentLicenseAssigned(
    @Payload() payload: StudentLicenseAssignedPayload,
  ): void {
    this.logger.log(
      `Received user.student.license-assigned for studentId=${payload.studentId}, newTier=${payload.newTier}`,
    );
  }
}
