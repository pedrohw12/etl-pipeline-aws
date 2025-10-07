import { IsObject, IsOptional, IsString } from 'class-validator';

export class RunPipelineDto {
  @IsOptional()
  @IsString()
  bucket?: string;

  @IsString()
  key!: string;

  @IsString()
  content!: string;

  @IsOptional()
  @IsString()
  contentType?: string;

  @IsOptional()
  @IsString()
  outputBucket?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, string>;
}
