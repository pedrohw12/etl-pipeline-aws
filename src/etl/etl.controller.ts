import { Controller, Get, Param, Post, Body } from '@nestjs/common';
import { EtlService } from './etl.service';
import { UploadRequestDto } from './dto/upload-request.dto';
import { RunPipelineDto } from './dto/run-pipeline.dto';

@Controller('etl')
export class EtlController {
  constructor(private readonly etlService: EtlService) {}

  @Post('upload')
  async upload(@Body() dto: UploadRequestDto) {
    return this.etlService.uploadSourceObject(dto);
  }

  @Post('run')
  async runPipeline(@Body() dto: RunPipelineDto) {
    return this.etlService.runPipeline(dto);
  }

  @Get('jobs/:jobRunId')
  async getJobRun(@Param('jobRunId') jobRunId: string) {
    return this.etlService.getJobRun(jobRunId);
  }
}
