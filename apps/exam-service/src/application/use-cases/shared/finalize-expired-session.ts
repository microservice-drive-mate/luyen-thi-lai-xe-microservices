import { ExamSession } from '../../../domain/aggregates/exam-session/exam-session.aggregate';
import { ExamSessionRepository } from '../../../domain/repositories/exam-session.repository';

export async function finalizeExpiredSessionIfNeeded(
  session: ExamSession,
  sessionRepository: ExamSessionRepository,
): Promise<boolean> {
  const finalized = session.expireIfNeeded();
  if (!finalized) return false;

  await sessionRepository.save(session);
  return true;
}
