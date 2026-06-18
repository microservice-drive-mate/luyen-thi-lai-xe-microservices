import { ExamSession } from '../../../domain/aggregates/exam-session/exam-session.aggregate';
import { ExamSessionRepository } from '../../../domain/repositories/exam-session.repository';
import { EventPublisher } from '../../ports/event-publisher.port';

export async function finalizeExpiredSessionIfNeeded(
  session: ExamSession,
  sessionRepository: ExamSessionRepository,
  eventPublisher: EventPublisher,
): Promise<boolean> {
  const finalized = session.expireIfNeeded();
  if (!finalized) return false;

  await sessionRepository.save(session);
  const events = session.getDomainEvents();
  session.clearDomainEvents();
  await eventPublisher.publishAll(events);
  return true;
}
