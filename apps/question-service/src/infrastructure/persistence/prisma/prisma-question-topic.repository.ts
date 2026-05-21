import { Injectable } from '@nestjs/common';
import { QuestionTopic } from '../../../domain/aggregates/question-topic/question-topic.aggregate';
import {
  ListQuestionTopicsFilter,
  ListQuestionTopicsPage,
  QuestionTopicRepository,
} from '../../../domain/repositories/question-topic.repository';
import { QuestionTopicMapper } from '../mappers/question-topic.mapper';
import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaQuestionTopicRepository extends QuestionTopicRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findById(id: string): Promise<QuestionTopic | null> {
    const raw = await this.prisma.questionTopic.findUnique({ where: { id } });
    return raw ? QuestionTopicMapper.toDomain(raw) : null;
  }

  async existsById(id: string): Promise<boolean> {
    const count = await this.prisma.questionTopic.count({ where: { id } });
    return count > 0;
  }

  async findAll(
    filter: ListQuestionTopicsFilter,
  ): Promise<ListQuestionTopicsPage> {
    const where = {
      ...(filter.parentId !== undefined && { parentId: filter.parentId }),
    };
    const skip = (filter.page - 1) * filter.size;
    const [rawItems, total] = await this.prisma.$transaction([
      this.prisma.questionTopic.findMany({
        where,
        skip,
        take: filter.size,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.questionTopic.count({ where }),
    ]);
    return {
      items: rawItems.map(QuestionTopicMapper.toDomain),
      total,
    };
  }

  async save(topic: QuestionTopic): Promise<void> {
    await this.prisma.questionTopic.upsert({
      where: { id: topic.id },
      create: {
        id: topic.id,
        name: topic.name,
        description: topic.description,
        parentId: topic.parentId,
        createdAt: topic.createdAt,
      },
      update: {
        name: topic.name,
        description: topic.description,
        parentId: topic.parentId,
      },
    });
  }
}
