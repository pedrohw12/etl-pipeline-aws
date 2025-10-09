import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  InvokeCommand,
  InvokeCommandOutput,
  LambdaClient,
} from '@aws-sdk/client-lambda';
import { ConfigService } from '@nestjs/config';
import { LAMBDA_CLIENT } from './aws.constants';
import { AwsConfig } from '../config/aws-config.interface';

@Injectable()
export class LambdaService {
  private readonly logger = new Logger(LambdaService.name);
  private readonly ingestFunctionName: string;

  constructor(
    @Inject(LAMBDA_CLIENT) private readonly client: LambdaClient,
    private readonly configService: ConfigService,
  ) {
    const { ingestLambdaFunctionName } =
      this.configService.getOrThrow<AwsConfig>('aws');
    this.ingestFunctionName = ingestLambdaFunctionName;
  }

  async invokeFunction(
    functionName: string,
    payload: unknown,
    invocationType: 'Event' | 'RequestResponse' = 'Event',
  ): Promise<InvokeCommandOutput> {
    const response = await this.client.send(
      new InvokeCommand({
        FunctionName: functionName,
        InvocationType: invocationType,
        Payload: Buffer.from(JSON.stringify(payload)),
      }),
    );

    this.logger.log(
      `Invoked lambda ${functionName} with payload ${JSON.stringify(payload)}`,
    );

    return response;
  }

  // Exposed so NestJS can hand uploads to the ingest lambda and let the
  // S3-driven pipeline continue on its own.
  async invokeIngestLambda(payload: unknown): Promise<InvokeCommandOutput> {
    return this.invokeFunction(this.ingestFunctionName, payload, 'Event');
  }

  getIngestFunctionName(): string {
    return this.ingestFunctionName;
  }
}
