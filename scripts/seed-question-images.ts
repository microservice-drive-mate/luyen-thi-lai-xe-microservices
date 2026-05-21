import {
  BlobServiceClient,
  StorageSharedKeyCredential,
} from '@azure/storage-blob';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  FileStatus,
  PrismaClient as MediaPrismaClient,
} from '@prisma/media-client';
import { PrismaClient as QuestionPrismaClient } from '@prisma/question-client';
import axios from 'axios';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { inflateRawSync } from 'node:zlib';

const CONSUL_URL = process.env.CONSUL_URL || 'http://127.0.0.1:8500';
const DOCX_PATH = path.resolve(process.cwd(), 'seed/600-cau-hoi.docx');
const UPLOADED_BY_ID = '10000000-0000-0000-0000-000000000001';
const STORAGE_PREFIX = 'question-bank/600-cau-hoi';

interface ZipEntry {
  name: string;
  compressionMethod: number;
  compressedSize: number;
  localHeaderOffset: number;
}

interface ImageMapping {
  questionNumber: number;
  relationshipId: string;
  target: string;
  entryName: string;
}

interface MediaStorageConfig {
  accountName: string;
  accountKey: string;
  containerName: string;
}

function resolveDefaultEnvironment(consulUrl: string): string {
  const normalized = consulUrl.toLowerCase();
  if (normalized.includes('localhost') || normalized.includes('127.0.0.1')) {
    return 'development-local';
  }

  return 'development';
}

function parseConsulValue(raw: string): string {
  try {
    return String(JSON.parse(raw));
  } catch {
    return raw;
  }
}

function normalizeLocalDatabaseUrl(databaseUrl: string): string {
  try {
    const parsed = new URL(databaseUrl);
    if (parsed.hostname === 'localhost') {
      parsed.hostname = '127.0.0.1';
      return parsed.toString();
    }
  } catch {
    // Keep the original value so Prisma can surface a useful error.
  }

  return databaseUrl;
}

async function fetchConsulValue(
  environment: string,
  serviceName: string,
  key: string,
): Promise<string> {
  const consulKey = `config/${environment}/${serviceName}/${key}`;
  const response = await axios.get(`${CONSUL_URL}/v1/kv/${consulKey}`);

  if (!response.data || response.data.length === 0) {
    throw new Error(`Consul key not found: ${consulKey}`);
  }

  const kvData = response.data[0] as { Value: string };
  const raw = Buffer.from(kvData.Value, 'base64').toString('utf-8');
  return parseConsulValue(raw);
}

function readZipEntries(zip: Buffer): ZipEntry[] {
  const eocdOffset = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocdOffset === -1) {
    throw new Error('Invalid docx zip: end-of-central-directory not found');
  }

  const centralDirectorySize = zip.readUInt32LE(eocdOffset + 12);
  const centralDirectoryOffset = zip.readUInt32LE(eocdOffset + 16);
  const centralDirectoryEnd = centralDirectoryOffset + centralDirectorySize;
  let offset = centralDirectoryOffset;
  const entries: ZipEntry[] = [];

  while (offset < centralDirectoryEnd) {
    if (zip.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error('Invalid docx zip: bad central directory header');
    }

    const compressionMethod = zip.readUInt16LE(offset + 10);
    const compressedSize = zip.readUInt32LE(offset + 20);
    const fileNameLength = zip.readUInt16LE(offset + 28);
    const extraFieldLength = zip.readUInt16LE(offset + 30);
    const fileCommentLength = zip.readUInt16LE(offset + 32);
    const localHeaderOffset = zip.readUInt32LE(offset + 42);
    const name = zip
      .subarray(offset + 46, offset + 46 + fileNameLength)
      .toString('utf-8');

    entries.push({
      name,
      compressionMethod,
      compressedSize,
      localHeaderOffset,
    });

    offset += 46 + fileNameLength + extraFieldLength + fileCommentLength;
  }

  return entries;
}

function readZipEntry(zip: Buffer, entry: ZipEntry): Buffer {
  const localFileNameLength = zip.readUInt16LE(entry.localHeaderOffset + 26);
  const localExtraFieldLength = zip.readUInt16LE(entry.localHeaderOffset + 28);
  const dataOffset =
    entry.localHeaderOffset + 30 + localFileNameLength + localExtraFieldLength;
  const compressedData = zip.subarray(
    dataOffset,
    dataOffset + entry.compressedSize,
  );

  if (entry.compressionMethod === 0) {
    return compressedData;
  }
  if (entry.compressionMethod === 8) {
    return inflateRawSync(compressedData);
  }

  throw new Error(
    `Unsupported docx compression method: ${entry.compressionMethod}`,
  );
}

function getZipEntry(zip: Buffer, entries: ZipEntry[], name: string): Buffer {
  const entry = entries.find((item) => item.name === name);
  if (!entry) {
    throw new Error(`Entry not found in docx: ${name}`);
  }

  return readZipEntry(zip, entry);
}

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function extractText(paragraphXml: string): string {
  return normalizeText(
    Array.from(
      paragraphXml.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g),
      (match) => decodeXml(match[1]),
    ).join(''),
  );
}

function parseRelationships(relsXml: string): Map<string, string> {
  const relationships = new Map<string, string>();

  for (const match of relsXml.matchAll(/<Relationship\b([^>]+?)\/>/g)) {
    const attrs = match[1];
    const id = attrs.match(/\bId="([^"]+)"/)?.[1];
    const target = attrs.match(/\bTarget="([^"]+)"/)?.[1];
    const type = attrs.match(/\bType="([^"]+)"/)?.[1] ?? '';

    if (id && target && type.endsWith('/image')) {
      relationships.set(id, target);
    }
  }

  return relationships;
}

function parseQuestionImageMappings(docxPath: string): ImageMapping[] {
  if (!existsSync(docxPath)) {
    throw new Error(`Seed docx not found: ${docxPath}`);
  }

  const zip = readFileSync(docxPath);
  const entries = readZipEntries(zip);
  const documentXml = getZipEntry(zip, entries, 'word/document.xml').toString(
    'utf-8',
  );
  const relsXml = getZipEntry(
    zip,
    entries,
    'word/_rels/document.xml.rels',
  ).toString('utf-8');
  const relationships = parseRelationships(relsXml);
  const mappings: ImageMapping[] = [];
  let currentQuestionNumber: number | null = null;

  for (const paragraphMatch of documentXml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)) {
    const paragraphXml = paragraphMatch[0];
    const text = extractText(paragraphXml);
    const questionMatch = text.match(/Câu\s+(\d+)[.:]/u);
    if (questionMatch) {
      currentQuestionNumber = Number(questionMatch[1]);
    }

    const relationshipIds = Array.from(
      paragraphXml.matchAll(/<a:blip\b[^>]*r:embed="([^"]+)"/g),
      (match) => match[1],
    );
    if (!currentQuestionNumber || relationshipIds.length === 0) {
      continue;
    }

    for (const relationshipId of relationshipIds) {
      const target = relationships.get(relationshipId);
      if (!target) {
        continue;
      }
      const entryName = path.posix.normalize(`word/${target}`);
      if (!entries.some((entry) => entry.name === entryName)) {
        continue;
      }
      mappings.push({
        questionNumber: currentQuestionNumber,
        relationshipId,
        target,
        entryName,
      });
    }
  }

  return mappings;
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

function questionIdForNumber(questionNumber: number): string {
  return deterministicUuid(`bca-600-question-${questionNumber}`);
}

function mediaIdForQuestion(questionNumber: number): string {
  return deterministicUuid(`bca-600-question-${questionNumber}-image-1`);
}

function mimeTypeForEntry(entryName: string): string {
  const ext = path.extname(entryName).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.webp') return 'image/webp';
  return 'application/octet-stream';
}

function extensionForEntry(entryName: string): string {
  const ext = path.extname(entryName).toLowerCase();
  return ext === '.jpeg' ? '.jpg' : ext || '.bin';
}

async function fetchConfig(environment: string) {
  const [
    questionDatabaseUrl,
    mediaDatabaseUrl,
    accountName,
    accountKey,
    containerName,
  ] = await Promise.all([
    fetchConsulValue(environment, 'question-service', 'database.url'),
    fetchConsulValue(environment, 'media-service', 'database.url'),
    fetchConsulValue(environment, 'media-service', 'storage.accountName'),
    fetchConsulValue(environment, 'media-service', 'storage.accountKey'),
    fetchConsulValue(environment, 'media-service', 'storage.containerName'),
  ]);

  return {
    questionDatabaseUrl: normalizeLocalDatabaseUrl(questionDatabaseUrl),
    mediaDatabaseUrl: normalizeLocalDatabaseUrl(mediaDatabaseUrl),
    storage: { accountName, accountKey, containerName },
  };
}

function chooseFirstImagePerQuestion(mappings: ImageMapping[]) {
  const selected = new Map<number, ImageMapping>();
  const extras = new Map<number, ImageMapping[]>();
  const splitImageTargets = new Map<number, number>([
    [551, 552],
    [553, 554],
    [555, 556],
    [557, 558],
    [559, 560],
    [573, 574],
  ]);

  for (const mapping of mappings) {
    if (!selected.has(mapping.questionNumber)) {
      selected.set(mapping.questionNumber, mapping);
      continue;
    }

    const splitTarget = splitImageTargets.get(mapping.questionNumber);
    if (splitTarget && !selected.has(splitTarget)) {
      selected.set(splitTarget, { ...mapping, questionNumber: splitTarget });
      continue;
    }

    const currentExtras = extras.get(mapping.questionNumber) ?? [];
    currentExtras.push(mapping);
    extras.set(mapping.questionNumber, currentExtras);
  }

  return { selected, extras };
}

async function uploadAndLinkImages(
  selected: Map<number, ImageMapping>,
  zip: Buffer,
  entries: ZipEntry[],
  storage: MediaStorageConfig,
  mediaPrisma: MediaPrismaClient,
  questionPrisma: QuestionPrismaClient,
) {
  const credential = new StorageSharedKeyCredential(
    storage.accountName,
    storage.accountKey,
  );
  const blobServiceClient = new BlobServiceClient(
    `https://${storage.accountName}.blob.core.windows.net`,
    credential,
  );
  const containerClient = blobServiceClient.getContainerClient(
    storage.containerName,
  );
  await containerClient.createIfNotExists();

  let uploadedCount = 0;
  let linkedCount = 0;

  for (const [questionNumber, mapping] of Array.from(selected).sort(
    ([left], [right]) => left - right,
  )) {
    const entry = entries.find((item) => item.name === mapping.entryName);
    if (!entry) {
      throw new Error(`Missing image entry: ${mapping.entryName}`);
    }

    const buffer = readZipEntry(zip, entry);
    const mimeType = mimeTypeForEntry(mapping.entryName);
    const extension = extensionForEntry(mapping.entryName);
    const mediaFileId = mediaIdForQuestion(questionNumber);
    const storageKey = `${STORAGE_PREFIX}/q${String(questionNumber).padStart(
      3,
      '0',
    )}${extension}`;
    const blobClient = containerClient.getBlockBlobClient(storageKey);

    await blobClient.uploadData(buffer, {
      blobHTTPHeaders: { blobContentType: mimeType },
    });
    uploadedCount += 1;

    await mediaPrisma.fileObject.upsert({
      where: { id: mediaFileId },
      update: {
        storageKey,
        originalName: `q${questionNumber}${extension}`,
        mimeType,
        fileSize: buffer.length,
        bucketName: storage.containerName,
        uploadedById: UPLOADED_BY_ID,
        isPublic: false,
        status: FileStatus.LINKED,
      },
      create: {
        id: mediaFileId,
        storageKey,
        originalName: `q${questionNumber}${extension}`,
        mimeType,
        fileSize: buffer.length,
        bucketName: storage.containerName,
        uploadedById: UPLOADED_BY_ID,
        isPublic: false,
        status: FileStatus.LINKED,
      },
    });

    const updateResult = await questionPrisma.question.updateMany({
      where: { id: questionIdForNumber(questionNumber) },
      data: {
        imageUrl: blobClient.url,
        mediaFileId,
      },
    });

    if (updateResult.count !== 1) {
      throw new Error(
        `Question ${questionNumber} not found. Run npm run db:seed:question first.`,
      );
    }

    linkedCount += updateResult.count;
  }

  return { uploadedCount, linkedCount };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const environment =
    args.find((arg) => !arg.startsWith('--')) ||
    process.env.NODE_ENV ||
    resolveDefaultEnvironment(CONSUL_URL);
  console.log(`[question-image-seed] Consul URL : ${CONSUL_URL}`);
  console.log(`[question-image-seed] Environment: ${environment}`);

  const zip = readFileSync(DOCX_PATH);
  const entries = readZipEntries(zip);
  const mappings = parseQuestionImageMappings(DOCX_PATH);
  const { selected, extras } = chooseFirstImagePerQuestion(mappings);

  console.log(`[question-image-seed] Embedded image refs: ${mappings.length}`);
  console.log(`[question-image-seed] Questions with images: ${selected.size}`);
  if (extras.size > 0) {
    console.warn(
      `[question-image-seed] Questions with extra images ignored for v1: ${Array.from(
        extras.keys(),
      ).join(', ')}`,
    );
  }
  if (dryRun) {
    console.log('[question-image-seed] Dry run only. No upload or DB writes.');
    return;
  }

  const config = await fetchConfig(environment);
  const mediaPrisma = new MediaPrismaClient({
    adapter: new PrismaPg({ connectionString: config.mediaDatabaseUrl }),
  });
  const questionPrisma = new QuestionPrismaClient({
    adapter: new PrismaPg({ connectionString: config.questionDatabaseUrl }),
  });

  try {
    const { uploadedCount, linkedCount } = await uploadAndLinkImages(
      selected,
      zip,
      entries,
      config.storage,
      mediaPrisma,
      questionPrisma,
    );

    console.log(`[question-image-seed] Uploaded images: ${uploadedCount}`);
    console.log(`[question-image-seed] Linked questions: ${linkedCount}`);
  } finally {
    await mediaPrisma.$disconnect();
    await questionPrisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[question-image-seed] ${message}`);
  process.exit(1);
});
