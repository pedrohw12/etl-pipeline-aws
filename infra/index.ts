import * as path from 'path';
import * as pulumi from '@pulumi/pulumi';
import * as aws from '@pulumi/aws';
import { bundleLambda } from './src/bundling';

const config = new pulumi.Config('etl');

const landingBucketName = optional(config.get('landingBucketName'));
const transformedBucketName = optional(config.get('transformedBucketName'));
const lambdaFunctionName = optional(config.get('lambdaFunctionName'));
const ingestLambdaFunctionName = optional(config.get('ingestLambdaFunctionName'));
const glueJobName = optional(config.get('glueJobName')) ?? 'etl-demo-job';

function optional(value: string | undefined | null): string | undefined {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

const landingBucketArgs: aws.s3.BucketV2Args = {
  forceDestroy: true,
  tags: {
    Project: 'etl-pipeline-demo',
    Purpose: 'landing',
  },
};

if (landingBucketName) {
  landingBucketArgs.bucket = landingBucketName;
}

// Landing bucket that both NestJS uploads into and S3 uses to trigger the Lambda.
const landingBucket = new aws.s3.BucketV2('landingBucket', landingBucketArgs);

const transformedBucketArgs: aws.s3.BucketV2Args = {
  forceDestroy: true,
  tags: {
    Project: 'etl-pipeline-demo',
    Purpose: 'transformed',
  },
};

if (transformedBucketName) {
  transformedBucketArgs.bucket = transformedBucketName;
}

// Destination bucket for the Glue job output; name is injected into the Lambda env.
const transformedBucket = new aws.s3.BucketV2('transformedBucket', transformedBucketArgs);

const ingestLambdaRole = new aws.iam.Role('ingestLambdaRole', {
  assumeRolePolicy: JSON.stringify({
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Principal: { Service: 'lambda.amazonaws.com' },
        Action: 'sts:AssumeRole',
      },
    ],
  }),
  description: 'Lambda role that uploads incoming payloads into the landing bucket',
});

new aws.iam.RolePolicyAttachment('ingestLambdaBasicExecution', {
  role: ingestLambdaRole.name,
  policyArn: 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
});

const ingestLambdaPolicy = landingBucket.arn.apply((landingArn) =>
  JSON.stringify({
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Action: ['s3:PutObject', 's3:GetObject'],
        Resource: [`${landingArn}/*`],
      },
    ],
  }),
);

new aws.iam.RolePolicy('ingestLambdaBucketPolicy', {
  role: ingestLambdaRole.id,
  policy: ingestLambdaPolicy,
});

const ingestLambdaCode = bundleLambda(path.resolve(__dirname, '../lambda/ingest-handler.ts'));

const ingestLambdaArgs: aws.lambda.FunctionArgs = {
  role: ingestLambdaRole.arn,
  runtime: 'nodejs18.x',
  handler: 'index.handler',
  timeout: 30,
  code: ingestLambdaCode,
  environment: {
    variables: {
      AWS_REGION: aws.getRegionOutput().name,
      AWS_SOURCE_BUCKET: landingBucket.bucket,
    },
  },
};

if (ingestLambdaFunctionName) {
  ingestLambdaArgs.name = ingestLambdaFunctionName;
}

const ingestLambdaFn = new aws.lambda.Function('etlIngest', ingestLambdaArgs);

const glueRole = new aws.iam.Role('glueJobRole', {
  assumeRolePolicy: JSON.stringify({
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Principal: { Service: 'glue.amazonaws.com' },
        Action: 'sts:AssumeRole',
      },
    ],
  }),
  description: 'Role assumed by Glue ETL job to read landing data and write transformed results',
});

new aws.iam.RolePolicyAttachment('glueServiceRoleAttachment', {
  role: glueRole.name,
  policyArn: 'arn:aws:iam::aws:policy/service-role/AWSGlueServiceRole',
});

const glueS3Policy = pulumi.all([
  landingBucket.arn,
  transformedBucket.arn,
]).apply(([landingArn, transformedArn]) =>
  JSON.stringify({
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Action: ['s3:GetObject'],
        Resource: [`${landingArn}/*`],
      },
      {
        Effect: 'Allow',
        Action: ['s3:PutObject', 's3:GetObject'],
        Resource: [`${transformedArn}/*`],
      },
    ],
  }),
);

new aws.iam.RolePolicy('glueBucketPolicy', {
  role: glueRole.id,
  policy: glueS3Policy,
});

const glueScriptKey = 'scripts/glue-job.py';
const glueScriptPath = path.resolve(__dirname, '../glue/job.py');

const glueScriptObject = new aws.s3.BucketObjectv2('glueScriptObject', {
  bucket: landingBucket.id,
  key: glueScriptKey,
  source: new pulumi.asset.FileAsset(glueScriptPath),
});

const glueJobArgs: aws.glue.JobArgs = {
  roleArn: glueRole.arn,
  command: {
    name: 'glueetl',
    pythonVersion: '3',
    scriptLocation: pulumi.interpolate`s3://${landingBucket.bucket}/${glueScriptKey}`,
  },
  glueVersion: '4.0',
  defaultArguments: {
    '--SOURCE_BUCKET': landingBucket.bucket,
    '--OUTPUT_BUCKET': transformedBucket.bucket,
    '--job-language': 'python',
  },
  executionProperty: {
    maxConcurrentRuns: 1,
  },
  maxRetries: 0,
  description: 'Pulumi managed job that transforms landing data then writes to transformed bucket',
  timeout: 10,
};

if (glueJobName) {
  glueJobArgs.name = glueJobName;
}

// Managed Glue job that the S3-triggered Lambda starts with bucket/key args.
const glueJob = new aws.glue.Job('glueJob', glueJobArgs, { dependsOn: [glueScriptObject] });

const lambdaRole = new aws.iam.Role('lambdaRole', {
  assumeRolePolicy: JSON.stringify({
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Principal: { Service: 'lambda.amazonaws.com' },
        Action: 'sts:AssumeRole',
      },
    ],
  }),
  description: 'Lambda role that invokes Glue job and reads landing bucket',
});

new aws.iam.RolePolicyAttachment('lambdaBasicExecution', {
  role: lambdaRole.name,
  policyArn: 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
});

const lambdaPolicy = pulumi
  .all([landingBucket.arn, transformedBucket.arn, glueJob.arn])
  .apply(([landingArn, transformedArn, glueArn]) =>
    JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Action: ['s3:GetObject'],
          Resource: [`${landingArn}/*`],
        },
        {
          Effect: 'Allow',
          Action: ['s3:PutObject', 's3:GetObject'],
          Resource: [`${transformedArn}/*`],
        },
        {
          Effect: 'Allow',
          Action: ['glue:StartJobRun'],
          Resource: [glueArn],
        },
      ],
    }),
  );

new aws.iam.RolePolicy('lambdaAccessPolicy', {
  role: lambdaRole.id,
  policy: lambdaPolicy,
});

const lambdaCode = bundleLambda(path.resolve(__dirname, '../lambda/handler.ts'));

const lambdaArgs: aws.lambda.FunctionArgs = {
  role: lambdaRole.arn,
  runtime: 'nodejs18.x',
  handler: 'index.handler',
  timeout: 30,
  code: lambdaCode,
  environment: {
    variables: {
      AWS_REGION: aws.getRegionOutput().name,
      AWS_SOURCE_BUCKET: landingBucket.bucket,
      AWS_TRANSFORMED_BUCKET: transformedBucket.bucket,
      AWS_GLUE_JOB_NAME: glueJob.name,
    },
  },
};

if (lambdaFunctionName) {
  lambdaArgs.name = lambdaFunctionName;
}

// Lambda that S3 invokes; environment variables inform the handler which Glue job to call.
const lambdaFn = new aws.lambda.Function('etlTrigger', lambdaArgs);

const lambdaPermission = new aws.lambda.Permission('allowS3Invoke', {
  action: 'lambda:InvokeFunction',
  function: lambdaFn.name,
  principal: 's3.amazonaws.com',
  sourceArn: landingBucket.arn,
});

// Wires the landing bucket to invoke the Lambda on new objects, closing the loop.
new aws.s3.BucketNotification('landingNotifications',
  {
    bucket: landingBucket.id,
    lambdaFunctions: [
      {
        lambdaFunctionArn: lambdaFn.arn,
        events: ['s3:ObjectCreated:Put'],
      },
    ],
  },
  { dependsOn: [lambdaPermission] },
);

export const landingBucketOutput = landingBucket.bucket;
export const transformedBucketOutput = transformedBucket.bucket;
export const ingestLambdaFunctionOutput = ingestLambdaFn.name;
export const lambdaFunctionOutput = lambdaFn.name;
export const glueJobOutput = glueJob.name;
