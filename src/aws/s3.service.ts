import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import { S3_CLIENT } from './aws.constants';
import { AwsConfig } from '../config/aws-config.interface';

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly defaultBucket: string;

  constructor(
    @Inject(S3_CLIENT) private readonly client: S3Client,
    private readonly configService: ConfigService,
  ) {
    const { sourceBucket } =
      this.configService.getOrThrow<AwsConfig>('aws');
    this.defaultBucket = sourceBucket;
  }

  // Makes sure the working bucket exists before any object write is attempted.
  async ensureBucket(bucketName?: string): Promise<void> {
    const bucket = bucketName ?? this.defaultBucket;
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: bucket }));
    } catch (error: any) {
      if (error?.$metadata?.httpStatusCode === 404 || error?.Code === 'NotFound') {
        this.logger.log(`Bucket ${bucket} not found. Creating it now.`);
        await this.client.send(new CreateBucketCommand({ Bucket: bucket }));
      } else if (error?.name === 'Forbidden') {
        this.logger.warn(
          `The credentials do not have access to bucket ${bucket}. Skipping creation.`,
        );
      } else {
        throw error;
      }
    }
  }

  // Accepts payload details, resolves the bucket, and forwards the upload to AWS S3.
  async uploadObject(options: {
    bucket?: string;
    key: string;
    body: string | Buffer;
    contentType?: string;
    metadata?: Record<string, string>;
  }): Promise<void> {
    const { bucket, key, body, contentType, metadata } = options;
    const resolvedBucket = bucket ?? this.defaultBucket;

    await this.ensureBucket(resolvedBucket);

    await this.client.send(
      new PutObjectCommand({
        Bucket: resolvedBucket,
        Key: key,
        Body: typeof body === 'string' ? Buffer.from(body) : body,
        ContentType: contentType ?? 'application/json',
        Metadata: metadata,
      }),
    );

    this.logger.log(`Uploaded object s3://${resolvedBucket}/${key}`);
  }
}
