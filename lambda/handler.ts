import { GlueClient, StartJobRunCommand } from '@aws-sdk/client-glue';

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

const jobName = process.env.AWS_GLUE_JOB_NAME ?? 'etl-demo-job';
const outputBucket =
  process.env.AWS_TRANSFORMED_BUCKET ?? 'etl-transformed-bucket';

export const handler = async (event: S3Event) => {
  console.log('Received S3 event', JSON.stringify(event, null, 2));

  const record = event.Records[0];
  const sourceBucket = record.s3.bucket.name;
  const sourceKey = decodeURIComponent(record.s3.object.key);

  // Mirrors the job invocation that the NestJS service performs locally,
  // but here it runs inside AWS when S3 triggers the Lambda.
  const command = new StartJobRunCommand({
    JobName: jobName,
    Arguments: {
      '--SOURCE_BUCKET': sourceBucket,
      '--SOURCE_KEY': sourceKey,
      '--OUTPUT_BUCKET': outputBucket,
    },
  });

  const response = await glueClient.send(command);
  console.log('Started Glue job', response.JobRunId);

  return response;
};

export default handler;
