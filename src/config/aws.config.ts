export const awsConfig = () => ({
  aws: {
    region: process.env.AWS_REGION ?? 'us-east-1',
    sourceBucket: process.env.AWS_SOURCE_BUCKET ?? 'etl-source-bucket',
    transformedBucket:
      process.env.AWS_TRANSFORMED_BUCKET ?? 'etl-transformed-bucket',
    glueJobName: process.env.AWS_GLUE_JOB_NAME ?? 'etl-demo-job',
    ingestLambdaFunctionName:
      process.env.AWS_INGEST_LAMBDA_FUNCTION_NAME ?? 'etl-ingest',
  },
});
