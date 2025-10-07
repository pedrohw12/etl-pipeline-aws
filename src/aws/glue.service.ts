import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  GetJobRunCommand,
  GlueClient,
  StartJobRunCommand,
} from '@aws-sdk/client-glue';
import { ConfigService } from '@nestjs/config';
import { GLUE_CLIENT } from './aws.constants';
import { AwsConfig } from '../config/aws-config.interface';

@Injectable()
export class GlueService {
  private readonly logger = new Logger(GlueService.name);
  private readonly jobName: string;
  private readonly transformedBucket: string;

  constructor(
    @Inject(GLUE_CLIENT) private readonly client: GlueClient,
    private readonly configService: ConfigService,
  ) {
    const { glueJobName, transformedBucket } =
      this.configService.getOrThrow<AwsConfig>('aws');
    this.jobName = glueJobName;
    this.transformedBucket = transformedBucket;
  }

  async startEtlJob(options: {
    sourceBucket: string;
    sourceKey: string;
    outputBucket?: string;
  }): Promise<string> {
    const { sourceBucket, sourceKey, outputBucket } = options;

    const response = await this.client.send(
      new StartJobRunCommand({
        JobName: this.jobName,
        Arguments: {
          '--SOURCE_BUCKET': sourceBucket,
          '--SOURCE_KEY': sourceKey,
          '--OUTPUT_BUCKET': outputBucket ?? this.transformedBucket,
        },
      }),
    );

    const runId = response.JobRunId ?? '';
    this.logger.log(`Triggered Glue job ${this.jobName} (run: ${runId})`);
    return runId;
  }

  async getJobRun(jobRunId: string) {
    const response = await this.client.send(
      new GetJobRunCommand({
        JobName: this.jobName,
        RunId: jobRunId,
        PredecessorsIncluded: false,
      }),
    );
    return response.JobRun;
  }
}
