import { DomainException } from '@repo/common';

export class AcademicWarningRecipientRequiredException extends DomainException {
  readonly code = 'ACADEMIC_WARNING_RECIPIENT_REQUIRED';

  constructor() {
    super('At least one student recipient is required.');
  }
}
