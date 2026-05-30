import { Practice2dSession } from '../aggregates/practice2d/practice2d-session.aggregate';

export abstract class Practice2dSessionRepository {
  abstract findById(id: string): Promise<Practice2dSession | null>;
  abstract save(session: Practice2dSession): Promise<void>;
}
