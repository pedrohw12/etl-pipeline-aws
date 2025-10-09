import { Inject, Injectable, Logger } from '@nestjs/common';
import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda';
import { ConfigService } from '@nestjs/config';
import { LAMBDA_CLIENT } from './aws.constants';
import { AwsConfig } from '../config/aws-config.interface';

@Injectable()
export class LambdaService {
  private readonly logger = new Logger(LambdaService.name);
  private readonly functionName: string;

  constructor(
    @Inject(LAMBDA_CLIENT) private readonly client: LambdaClient,
    private readonly configService: ConfigService,
  ) {
    const { lambdaFunctionName } =
      this.configService.getOrThrow<AwsConfig>('aws');
    this.functionName = lambdaFunctionName;
  }

  // Receives fabricated S3 events from EtlService (or other callers) and triggers
  // the deployed Lambda asynchronously, handing control over to the actual handler.
  async invokeEtlLambda(payload: unknown): Promise<void> {
    await this.client.send(
      new InvokeCommand({
        FunctionName: this.functionName,
        InvocationType: 'Event',
        Payload: Buffer.from(JSON.stringify(payload)),
      }),
    );

    this.logger.log(`Invoked lambda ${this.functionName} with payload ${JSON.stringify(payload)}`);
  }
}
