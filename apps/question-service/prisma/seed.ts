import { PrismaPg } from '@prisma/adapter-pg';
import {
  LicenseCategory,
  PrismaClient,
  QuestionDifficulty,
  QuestionType,
} from '@prisma/question-client';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { inflateRawSync } from 'node:zlib';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is required to seed question data');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const DOCX_PATH = path.resolve(process.cwd(), '../../seed/600-cau-hoi.docx');
const CREATED_BY_ID = '10000000-0000-0000-0000-000000000001';
const LICENSE_CATEGORIES = [
  LicenseCategory.A1,
  LicenseCategory.A2,
  LicenseCategory.B1,
  LicenseCategory.B2,
  LicenseCategory.C,
  LicenseCategory.D,
  LicenseCategory.E,
  LicenseCategory.F,
];

const QUESTION_TOPICS = [
  {
    id: '10000000-0000-0000-0000-000000000101',
    chapter: 1,
    from: 1,
    to: 180,
    name: 'Quy định chung và quy tắc giao thông đường bộ',
    description: 'Bộ 600 câu hỏi Bộ Công an, câu 1-180',
  },
  {
    id: '10000000-0000-0000-0000-000000000102',
    chapter: 2,
    from: 181,
    to: 205,
    name: 'Văn hóa giao thông, đạo đức người lái xe, kỹ năng PCCC và cứu hộ cứu nạn',
    description: 'Bộ 600 câu hỏi Bộ Công an, câu 181-205',
  },
  {
    id: '10000000-0000-0000-0000-000000000103',
    chapter: 3,
    from: 206,
    to: 263,
    name: 'Kỹ thuật lái xe',
    description: 'Bộ 600 câu hỏi Bộ Công an, câu 206-263',
  },
  {
    id: '10000000-0000-0000-0000-000000000104',
    chapter: 4,
    from: 264,
    to: 300,
    name: 'Cấu tạo và sửa chữa',
    description: 'Bộ 600 câu hỏi Bộ Công an, câu 264-300',
  },
  {
    id: '10000000-0000-0000-0000-000000000105',
    chapter: 5,
    from: 301,
    to: 485,
    name: 'Báo hiệu đường bộ',
    description: 'Bộ 600 câu hỏi Bộ Công an, câu 301-485',
  },
  {
    id: '10000000-0000-0000-0000-000000000106',
    chapter: 6,
    from: 486,
    to: 600,
    name: 'Giải thế sa hình và kỹ năng xử lý tình huống giao thông',
    description: 'Bộ 600 câu hỏi Bộ Công an, câu 486-600',
  },
];

interface TextRun {
  text: string;
  underlined: boolean;
}

interface DocxParagraph {
  text: string;
  style: string | null;
  hasNumbering: boolean;
  underlined: boolean;
  runs: TextRun[];
}

interface ParsedOption {
  content: string;
  isCorrect: boolean;
}

interface ParsedQuestion {
  number: number;
  content: string;
  options: ParsedOption[];
}

function readZipEntry(zipPath: string, entryName: string): Buffer {
  const zip = readFileSync(zipPath);
  const eocdOffset = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));

  if (eocdOffset === -1) {
    throw new Error(`Invalid docx zip: ${zipPath}`);
  }

  const centralDirectorySize = zip.readUInt32LE(eocdOffset + 12);
  const centralDirectoryOffset = zip.readUInt32LE(eocdOffset + 16);
  let offset = centralDirectoryOffset;
  const centralDirectoryEnd = centralDirectoryOffset + centralDirectorySize;

  while (offset < centralDirectoryEnd) {
    if (zip.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error(`Invalid central directory in docx: ${zipPath}`);
    }

    const compressionMethod = zip.readUInt16LE(offset + 10);
    const compressedSize = zip.readUInt32LE(offset + 20);
    const fileNameLength = zip.readUInt16LE(offset + 28);
    const extraFieldLength = zip.readUInt16LE(offset + 30);
    const fileCommentLength = zip.readUInt16LE(offset + 32);
    const localHeaderOffset = zip.readUInt32LE(offset + 42);
    const fileName = zip
      .subarray(offset + 46, offset + 46 + fileNameLength)
      .toString('utf-8');

    if (fileName === entryName) {
      const localFileNameLength = zip.readUInt16LE(localHeaderOffset + 26);
      const localExtraFieldLength = zip.readUInt16LE(localHeaderOffset + 28);
      const dataOffset =
        localHeaderOffset + 30 + localFileNameLength + localExtraFieldLength;
      const compressedData = zip.subarray(
        dataOffset,
        dataOffset + compressedSize,
      );

      if (compressionMethod === 0) {
        return compressedData;
      }
      if (compressionMethod === 8) {
        return inflateRawSync(compressedData);
      }

      throw new Error(
        `Unsupported docx compression method: ${compressionMethod}`,
      );
    }

    offset += 46 + fileNameLength + extraFieldLength + fileCommentLength;
  }

  throw new Error(`Entry not found in docx: ${entryName}`);
}

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function textFromRun(runXml: string): string {
  const textMatches = runXml.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g);
  return Array.from(textMatches, (match) => decodeXml(match[1])).join('');
}

function parseParagraphs(documentXml: string): DocxParagraph[] {
  const paragraphs: DocxParagraph[] = [];
  const paragraphMatches = documentXml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g);

  for (const paragraphMatch of paragraphMatches) {
    const paragraphXml = paragraphMatch[0];
    const styleMatch = paragraphXml.match(/<w:pStyle\b[^>]*w:val="([^"]+)"/);
    const runs = Array.from(
      paragraphXml.matchAll(/<w:r\b[\s\S]*?<\/w:r>/g),
      (runMatch) => ({
        text: textFromRun(runMatch[0]),
        underlined: /<w:u\b/.test(runMatch[0]),
      }),
    ).filter((run) => run.text.length > 0);
    const text = normalizeText(runs.map((run) => run.text).join(''));

    if (!text) {
      continue;
    }

    paragraphs.push({
      text,
      style: styleMatch?.[1] ?? null,
      hasNumbering: /<w:numPr\b/.test(paragraphXml),
      underlined: runs.some((run) => run.underlined),
      runs,
    });
  }

  return paragraphs.flatMap(splitEmbeddedQuestionParagraph);
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function isQuestionStart(text: string): boolean {
  return /^Câu\s+\d+[.:]\s*/u.test(text);
}

function splitEmbeddedQuestionParagraph(
  paragraph: DocxParagraph,
): DocxParagraph[] {
  if (isQuestionStart(paragraph.text)) {
    return [paragraph];
  }

  const match = paragraph.text.match(/\s+Câu\s+\d+[.:]\s*/u);
  if (!match || match.index === undefined) {
    return [paragraph];
  }

  const splitIndex = match.index + 1;
  const before = paragraph.text.slice(0, splitIndex).trim();
  const after = paragraph.text.slice(splitIndex).trim();

  if (!before || !after) {
    return [paragraph];
  }

  return [
    {
      ...paragraph,
      text: before,
      underlined: isRangeUnderlined(paragraph.runs, 0, splitIndex),
    },
    {
      text: after,
      style: 'Heading1',
      hasNumbering: false,
      underlined: false,
      runs: [{ text: after, underlined: false }],
    },
  ];
}

function isRangeUnderlined(
  runs: TextRun[],
  startIndex: number,
  endIndex: number,
): boolean {
  let cursor = 0;
  for (const run of runs) {
    const runStart = cursor;
    const runEnd = cursor + run.text.length;
    cursor = runEnd;
    if (runEnd <= startIndex || runStart >= endIndex) {
      continue;
    }
    if (run.underlined) {
      return true;
    }
  }

  return false;
}

function parseQuestionsFromDocx(docxPath: string): ParsedQuestion[] {
  if (!existsSync(docxPath)) {
    throw new Error(`Seed docx not found: ${docxPath}`);
  }

  const documentXml = readZipEntry(docxPath, 'word/document.xml').toString(
    'utf-8',
  );
  const paragraphs = parseParagraphs(documentXml);
  const questions: ParsedQuestion[] = [];
  let currentQuestion: ParsedQuestion | null = null;

  for (const paragraph of paragraphs) {
    if (/^CHƯƠNG\s+/u.test(paragraph.text)) {
      continue;
    }

    const questionMatch = paragraph.text.match(/^Câu\s+(\d+)[.:]\s*(.*)$/u);
    if (questionMatch) {
      if (currentQuestion) {
        questions.push(currentQuestion);
      }
      currentQuestion = {
        number: Number(questionMatch[1]),
        content: normalizeText(questionMatch[2]),
        options: [],
      };
      continue;
    }

    if (!currentQuestion) {
      continue;
    }

    if (paragraph.hasNumbering || paragraph.style === 'ListParagraph') {
      currentQuestion.options.push({
        content: paragraph.text,
        isCorrect: paragraph.underlined,
      });
      continue;
    }

    const inlineOptions = parseInlineOptions(paragraph, currentQuestion.number);
    if (currentQuestion.options.length === 0 && inlineOptions.length > 0) {
      currentQuestion.options.push(...inlineOptions);
      continue;
    }

    if (currentQuestion.options.length > 0) {
      const lastOption =
        currentQuestion.options[currentQuestion.options.length - 1];
      lastOption.content = normalizeText(
        `${lastOption.content} ${paragraph.text}`,
      );
      lastOption.isCorrect = lastOption.isCorrect || paragraph.underlined;
    } else {
      currentQuestion.content = normalizeText(
        `${currentQuestion.content} ${paragraph.text}`,
      );
    }
  }

  if (currentQuestion) {
    questions.push(currentQuestion);
  }

  return normalizeParsedQuestions(questions);
}

function parseInlineOptions(
  paragraph: DocxParagraph,
  questionNumber: number,
): ParsedOption[] {
  if (
    questionNumber === 352 &&
    paragraph.text === '1. Biển 1.2. Biển 2.3. Cả hai biển.'
  ) {
    return [
      { content: 'Biển 1.', isCorrect: true },
      { content: 'Biển 2.', isCorrect: false },
      { content: 'Cả hai biển.', isCorrect: false },
    ];
  }

  const matches = Array.from(paragraph.text.matchAll(/(\d+)\.\s*/g));
  if (matches.length < 2 || matches[0].index !== 0) {
    return [];
  }

  return matches.map((match, index) => {
    const start = (match.index ?? 0) + match[0].length;
    const end =
      index + 1 < matches.length
        ? (matches[index + 1].index ?? paragraph.text.length)
        : paragraph.text.length;
    const content = normalizeText(paragraph.text.slice(start, end));

    return {
      content,
      isCorrect:
        questionNumber === 352
          ? index === 0
          : isRangeUnderlined(paragraph.runs, start, end),
    };
  });
}

function normalizeParsedQuestions(
  questions: ParsedQuestion[],
): ParsedQuestion[] {
  const result: ParsedQuestion[] = [];
  const splitOverrides = new Map<number, number>([
    [551, 4],
    [553, 4],
    [555, 2],
    [557, 4],
    [559, 4],
    [573, 3],
  ]);

  for (const question of questions) {
    const splitAt = splitOverrides.get(question.number);
    if (!splitAt) {
      result.push(question);
      continue;
    }

    result.push({
      ...question,
      options: question.options.slice(0, splitAt),
    });
    result.push({
      number: question.number + 1,
      content: `Câu ${question.number + 1}. Nội dung theo hình trong tài liệu gốc`,
      options: question.options.slice(splitAt),
    });
  }

  return result.sort((left, right) => left.number - right.number);
}

function deterministicUuid(input: string): string {
  const bytes = createHash('sha1').update(input).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(
    12,
    16,
  )}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function topicIdForQuestion(questionNumber: number): string {
  const topic = QUESTION_TOPICS.find(
    (item) => questionNumber >= item.from && questionNumber <= item.to,
  );
  if (!topic) {
    throw new Error(`No topic mapping for question ${questionNumber}`);
  }

  return topic.id;
}

function questionTypeForNumber(questionNumber: number): QuestionType {
  if (questionNumber >= 301 && questionNumber <= 485) {
    return QuestionType.TRAFFIC_SIGN;
  }
  if (questionNumber >= 486) {
    return QuestionType.SCENARIO_RELATED;
  }
  return QuestionType.THEORY;
}

function validateQuestions(questions: ParsedQuestion[]): void {
  const numbers = new Set(questions.map((question) => question.number));
  const missing = Array.from({ length: 600 }, (_, index) => index + 1).filter(
    (number) => !numbers.has(number),
  );
  if (questions.length !== 600 || missing.length > 0) {
    throw new Error(
      `Expected 600 questions, parsed ${questions.length}. Missing: ${missing.join(
        ', ',
      )}`,
    );
  }

  const invalidQuestions = questions.filter((question) => {
    const correctCount = question.options.filter(
      (option) => option.isCorrect,
    ).length;
    return (
      !question.content ||
      question.options.length < 2 ||
      question.options.length > 6 ||
      correctCount !== 1 ||
      question.options.some((option) => !option.content)
    );
  });

  if (invalidQuestions.length > 0) {
    throw new Error(
      `Invalid parsed questions: ${invalidQuestions
        .map(
          (question) =>
            `#${question.number} options=${question.options.length} correct=${
              question.options.filter((option) => option.isCorrect).length
            }`,
        )
        .join('; ')}`,
    );
  }
}

async function seedQuestionTopics() {
  for (const topic of QUESTION_TOPICS) {
    await prisma.questionTopic.upsert({
      where: { id: topic.id },
      update: {
        name: topic.name,
        description: topic.description,
        parentId: null,
      },
      create: {
        id: topic.id,
        name: topic.name,
        description: topic.description,
        parentId: null,
      },
    });
  }
}

async function seedQuestions(questions: ParsedQuestion[]) {
  for (const question of questions) {
    const questionId = deterministicUuid(`bca-600-question-${question.number}`);

    await prisma.$transaction(async (tx) => {
      await tx.question.upsert({
        where: { id: questionId },
        update: {
          content: question.content,
          type: questionTypeForNumber(question.number),
          licenseCategories: LICENSE_CATEGORIES,
          difficulty: QuestionDifficulty.EASY,
          explanation: `Đáp án đúng: ${
            question.options.find((option) => option.isCorrect)?.content ?? ''
          }`,
          imageUrl: null,
          mediaFileId: null,
          isCritical: false,
          isActive: true,
          isDeleted: false,
          topicId: topicIdForQuestion(question.number),
          createdById: CREATED_BY_ID,
          version: 1,
          deletedById: null,
          deletedAt: null,
        },
        create: {
          id: questionId,
          content: question.content,
          type: questionTypeForNumber(question.number),
          licenseCategories: LICENSE_CATEGORIES,
          difficulty: QuestionDifficulty.EASY,
          explanation: `Đáp án đúng: ${
            question.options.find((option) => option.isCorrect)?.content ?? ''
          }`,
          imageUrl: null,
          mediaFileId: null,
          isCritical: false,
          isActive: true,
          isDeleted: false,
          topicId: topicIdForQuestion(question.number),
          createdById: CREATED_BY_ID,
          version: 1,
          deletedById: null,
          deletedAt: null,
        },
      });

      await tx.questionOption.deleteMany({ where: { questionId } });
      await tx.questionOption.createMany({
        data: question.options.map((option, index) => ({
          id: deterministicUuid(
            `bca-600-question-${question.number}-option-${index + 1}`,
          ),
          questionId,
          content: option.content,
          isCorrect: option.isCorrect,
          displayOrder: index + 1,
        })),
      });
    });
  }
}

async function main() {
  const questions = parseQuestionsFromDocx(DOCX_PATH);
  validateQuestions(questions);

  await seedQuestionTopics();
  await seedQuestions(questions);

  console.log(`Seeded question topics: ${QUESTION_TOPICS.length}`);
  console.log(`Seeded questions: ${questions.length}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
