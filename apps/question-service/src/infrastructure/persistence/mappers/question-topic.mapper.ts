import { QuestionTopic } from '../../../domain/aggregates/question-topic/question-topic.aggregate';

interface RawQuestionTopic {
  id: string;
  name: string;
  description: string | null;
  parentId: string | null;
  createdAt: Date;
}

export class QuestionTopicMapper {
  static toDomain(raw: RawQuestionTopic): QuestionTopic {
    return QuestionTopic.reconstitute({
      id: raw.id,
      name: raw.name,
      description: raw.description,
      parentId: raw.parentId,
      createdAt: raw.createdAt,
    });
  }
}
