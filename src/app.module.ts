import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AwsModule } from './aws/aws.module';
import { EtlModule } from './etl/etl.module';
import { awsConfig } from './config/aws.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [awsConfig],
    }),
    AwsModule,
    EtlModule,
  ],
})
export class AppModule {}
