import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LambdaService } from '../aws/lambda.service';
import { GlueService } from '../aws/glue.service';
import { UploadRequestDto } from './dto/upload-request.dto';
import { RunPipelineDto } from './dto/run-pipeline.dto';
import { AwsConfig } from '../config/aws-config.interface';

@Injectable()
export class EtlService {
  private readonly logger = new Logger(EtlService.name);
  private readonly defaultBucket: string;

  constructor(
    private readonly lambdaService: LambdaService,
    private readonly glueService: GlueService,
    private readonly configService: ConfigService,
  ) {
    const { sourceBucket } =
      this.configService.getOrThrow<AwsConfig>('aws');
    this.defaultBucket = sourceBucket;
  }

  private buildIngestPayload(dto: UploadRequestDto | RunPipelineDto) {
    const bucket = dto.bucket ?? this.defaultBucket;
    const payload = {
      bucket,
      key: dto.key,
      content: dto.content,
      contentType: dto.contentType ?? 'application/json',
      metadata: dto.metadata,
      outputBucket: 'outputBucket' in dto ? dto.outputBucket : undefined,
    };
    return payload;
  }

  private async triggerIngestLambda(dto: UploadRequestDto | RunPipelineDto) {
    const payload = this.buildIngestPayload(dto);
    const response = await this.lambdaService.invokeIngestLambda(payload);

    return {
      bucket: payload.bucket,
      key: payload.key,
      lambdaRequestId: response.$metadata.requestId ?? null,
    };
  }

  async getJobRun(jobRunId: string) {
    return this.glueService.getJobRun(jobRunId);
  }

  async uploadSourceObject(dto: UploadRequestDto) {
    const result = await this.triggerIngestLambda(dto);
    this.logger.log(
      `Upload queued via ingest lambda ${this.lambdaService.getIngestFunctionName()} for s3://${result.bucket}/${result.key}`,
    );
    return {
      ...result,
      message:
        'Object upload scheduled via Lambda. Downstream processing will continue automatically.',
    };
  }

  // Primary orchestration now simply hands the upload to the ingest Lambda.
  // S3 notifications then invoke the Glue-triggering Lambda without additional NestJS work.
  async runPipeline(dto: RunPipelineDto) {
    const result = await this.triggerIngestLambda(dto);

    this.logger.log(
      `Pipeline triggered via ingest lambda ${this.lambdaService.getIngestFunctionName()} for s3://${result.bucket}/${result.key}`,
    );

    return {
      ...result,
      message:
        'Pipeline triggered asynchronously. Monitor the Glue-triggering Lambda for job run details.',
    };
  }
}
