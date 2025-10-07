export interface AwsConfig {
  region: string;
  sourceBucket: string;
  transformedBucket: string;
  glueJobName: string;
  lambdaFunctionName: string;
}
