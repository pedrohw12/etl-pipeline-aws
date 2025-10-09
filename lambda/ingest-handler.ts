import {
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

type IngestEvent = {
  bucket?: string;
  key: string;
  content: string;
  contentType?: string;
  metadata?: Record<string, string>;
  outputBucket?: string;
};

const s3Client = new S3Client({
  region: process.env.AWS_REGION ?? 'us-east-1',
});

const defaultBucket = process.env.AWS_SOURCE_BUCKET ?? '';
const defaultContentType =
  process.env.AWS_DEFAULT_CONTENT_TYPE ?? 'application/json';
const OUTPUT_BUCKET_METADATA_KEY = 'pipeline-output-bucket';

// This lambda function ingests an object into S3 landing bucket

export const handler = async (event: IngestEvent) => {
  if (!event?.key) {
    throw new Error('Missing object key');
  }

  const bucket = (event.bucket ?? defaultBucket).trim();
  if (!bucket) {
    throw new Error('Unable to resolve target bucket');
  }

  const body =
    typeof event.content === 'string'
      ? Buffer.from(event.content)
      : Buffer.from(JSON.stringify(event.content ?? {}));

  const metadata = {
    ...(event.metadata ?? {}),
    ...(event.outputBucket
      ? { [OUTPUT_BUCKET_METADATA_KEY]: event.outputBucket }
      : {}),
  };

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: event.key,
    Body: body,
    ContentType: event.contentType ?? defaultContentType,
    Metadata: metadata,
  });

  await s3Client.send(command);

  console.log(`Uploaded s3://${bucket}/${event.key} via ingest lambda`);

  return {
    bucket,
    key: event.key,
    metadataKeys: Object.keys(metadata),
  };
};

export default handler;
