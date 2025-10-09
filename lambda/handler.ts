import { GlueClient, StartJobRunCommand } from '@aws-sdk/client-glue';
import { HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';

// This handler is invoked by the S3 notification configured in infra/index.ts.
// S3 supplies the bucket/key in the event, and Pulumi wires the environment
// variables so we can pass them straight into Glue.

type S3EventRecord = {
  s3: {
    bucket: { name: string };
    object: { key: string };
  };
};

type S3Event = {
  Records: S3EventRecord[];
};

const glueClient = new GlueClient({
  region: process.env.AWS_REGION ?? 'us-east-1',
});

const s3Client = new S3Client({
  region: process.env.AWS_REGION ?? 'us-east-1',
});

const jobName = process.env.AWS_GLUE_JOB_NAME ?? 'etl-demo-job';
const defaultOutputBucket =
  process.env.AWS_TRANSFORMED_BUCKET ?? 'etl-transformed-bucket';
const OUTPUT_BUCKET_METADATA_KEY = 'pipeline-output-bucket';

export const handler = async (event: S3Event) => {
  console.log('Received S3 event', JSON.stringify(event, null, 2));

  const record = event.Records[0];
  const sourceBucket = record.s3.bucket.name;
  const sourceKey = decodeURIComponent(record.s3.object.key);

  const headObject = await s3Client.send(
    new HeadObjectCommand({
      Bucket: sourceBucket,
      Key: sourceKey,
    }),
  );

  const metadata = headObject.Metadata ?? {};
  const resolvedOutputBucket =
    metadata[OUTPUT_BUCKET_METADATA_KEY] ?? defaultOutputBucket;

  console.log(
    `Starting Glue job with output bucket ${resolvedOutputBucket} (metadata keys: ${Object.keys(metadata).join(', ')})`,
  );

  // Mirrors the job invocation that the NestJS service performs locally,
  // but here it runs inside AWS when S3 triggers the Lambda.
  const command = new StartJobRunCommand({
    JobName: jobName,
    Arguments: {
      '--SOURCE_BUCKET': sourceBucket,
      '--SOURCE_KEY': sourceKey,
      '--OUTPUT_BUCKET': resolvedOutputBucket,
    },
  });

  const response = await glueClient.send(command);
  console.log('Started Glue job', response.JobRunId);

  return response;
};

export default handler;
