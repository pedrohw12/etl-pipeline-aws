import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';
import { LambdaClient } from '@aws-sdk/client-lambda';
import { GlueClient } from '@aws-sdk/client-glue';
import { S3_CLIENT, LAMBDA_CLIENT, GLUE_CLIENT } from './aws.constants';
import { S3Service } from './s3.service';
import { LambdaService } from './lambda.service';
import { GlueService } from './glue.service';
import { AwsConfig } from '../config/aws-config.interface';

@Module({
  providers: [
    {
      provide: S3_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const { region } = configService.getOrThrow<AwsConfig>('aws');
        return new S3Client({ region });
      },
    },
    {
      provide: LAMBDA_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const { region } = configService.getOrThrow<AwsConfig>('aws');
        return new LambdaClient({ region });
      },
    },
    {
      provide: GLUE_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const { region } = configService.getOrThrow<AwsConfig>('aws');
        return new GlueClient({ region });
      },
    },
    S3Service,
    LambdaService,
    GlueService,
  ],
  exports: [S3Service, LambdaService, GlueService],
})
export class AwsModule {}
