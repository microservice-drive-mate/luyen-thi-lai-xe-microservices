import { QuestionTopic } from '../../../domain/aggregates/question-topic/question-topic.aggregate';

export class QuestionTopicResult {
  constructor(
    readonly id: string,
    readonly name: string,
    readonly description: string | null,
    readonly parentId: string | null,
    readonly createdAt: Date,
  ) {}

  static fromAggregate(topic: QuestionTopic): QuestionTopicResult {
    return new QuestionTopicResult(
      topic.id,
      topic.name,
      topic.description,
      topic.parentId,
      topic.createdAt,
    );
  }
}

export class ListQuestionTopicsResult {
  constructor(
    readonly items: QuestionTopicResult[],
    readonly total: number,
    readonly page: number,
    readonly size: number,
  ) {}
}
