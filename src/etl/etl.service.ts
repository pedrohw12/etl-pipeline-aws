import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Service } from '../aws/s3.service';
import { LambdaService } from '../aws/lambda.service';
import { GlueService } from '../aws/glue.service';
import { UploadRequestDto } from './dto/upload-request.dto';
import { RunPipelineDto } from './dto/run-pipeline.dto';
import { S3Event } from './interfaces/s3-event.interface';
import { AwsConfig } from '../config/aws-config.interface';

@Injectable()
export class EtlService {
  private readonly logger = new Logger(EtlService.name);
  private readonly defaultBucket: string;

  constructor(
    private readonly s3Service: S3Service,
    private readonly lambdaService: LambdaService,
    private readonly glueService: GlueService,
    private readonly configService: ConfigService,
  ) {
    const { sourceBucket } =
      this.configService.getOrThrow<AwsConfig>('aws');
    this.defaultBucket = sourceBucket;
  }

  // Entry point for POST /etl/upload; writes to S3 via S3Service so the object can
  // be picked up by the rest of the pipeline.
  async uploadSourceObject(dto: UploadRequestDto) {
    const bucket = dto.bucket ?? this.defaultBucket;
    await this.s3Service.uploadObject({
      bucket,
      key: dto.key,
      body: dto.content,
      contentType: dto.contentType ?? 'application/json',
      metadata: dto.metadata,
    });

    return { bucket, key: dto.key };
  }

  // Replicates the S3 notification payload the managed Lambda would receive in AWS.
  buildS3Event(bucket: string, key: string): S3Event {
    return {
      Records: [
        {
          eventSource: 'aws:s3',
          eventName: 'ObjectCreated:Put',
          s3: {
            bucket: { name: bucket },
            object: { key },
          },
        },
      ],
    };
  }

  // Sends the synthetic S3 event to the deployed Lambda so the same code path runs
  // whether the trigger is manual (API) or automatic (bucket notification).
  async invokeLambdaForObject(bucket: string, key: string) {
    const event = this.buildS3Event(bucket, key);
    await this.lambdaService.invokeEtlLambda(event);
    return event;
  }

  // Primary orchestration: uploads data, triggers the Lambda, then mirrors the Lambda's
  // Glue invocation locally so clients get a job run id immediately.
  async runPipeline(dto: RunPipelineDto) {
    const { bucket, key } = await this.uploadSourceObject(dto);

    const lambdaEvent = await this.invokeLambdaForObject(bucket, key);

    const jobRunId = await this.glueService.startEtlJob({
      sourceBucket: bucket,
      sourceKey: key,
      outputBucket: dto.outputBucket,
    });

    this.logger.log(
      `Pipeline started for s3://${bucket}/${key}. Glue job run id: ${jobRunId}`,
    );

    return {
      bucket,
      key,
      lambdaEvent,
      jobRunId,
    };
  }

  async getJobRun(jobRunId: string) {
    return this.glueService.getJobRun(jobRunId);
  }
}
