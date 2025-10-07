import { IsOptional, IsString } from 'class-validator';
import { IsObject } from 'class-validator';

export class UploadRequestDto {
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
  @IsObject()
  metadata?: Record<string, string>;
}
