import { QuestionTopic } from '../aggregates/question-topic/question-topic.aggregate';

export interface ListQuestionTopicsFilter {
  parentId?: string | null;
  page: number;
  size: number;
}

export interface ListQuestionTopicsPage {
  items: QuestionTopic[];
  total: number;
}

export abstract class QuestionTopicRepository {
  abstract findById(id: string): Promise<QuestionTopic | null>;
  abstract existsById(id: string): Promise<boolean>;
  abstract findAll(
    filter: ListQuestionTopicsFilter,
  ): Promise<ListQuestionTopicsPage>;
  abstract save(topic: QuestionTopic): Promise<void>;
}
