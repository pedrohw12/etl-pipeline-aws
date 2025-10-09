# NestJS ETL Pipeline Demo

This project showcases a minimal ETL pipeline built with NestJS and AWS services (S3, Lambda, and Glue).

### End-to-end flow (with code pointers)
- Uploads start in the NestJS API (`POST /etl/run` in `src/etl/etl.controller.ts`) which delegates to `EtlService.runPipeline` (`src/etl/etl.service.ts:41`). That service writes the raw file to the landing bucket through `S3Service.uploadObject`.
- `S3Service` (`src/aws/s3.service.ts`) wraps the AWS SDK `PutObjectCommand`; it resolves bucket names from `ConfigService` and ensures the bucket exists, so upstream callers only provide payload details.
- After the upload, `EtlService` fabricates the same S3 event structure that real S3 notifications emit and hands it to `LambdaService.invokeEtlLambda` (`src/aws/lambda.service.ts`). This method looks up the Lambda ARN from configuration (`aws.lambdaFunctionName`) and invokes it asynchronously.
- The runtime Lambda handler (`lambda/handler.ts`) is what production S3 notifications call. It receives the event, extracts the bucket/key, and issues `StartJobRunCommand` to Glue using environment variables pre-wired by the Pulumi stack.
- For local observability, the NestJS `EtlService` also triggers the Glue job directly via `GlueService.startEtlJob` (`src/aws/glue.service.ts`), mirroring the request the Lambda sends. The Glue script at `glue/job.py` reads those arguments, transforms the JSON lines, and writes to the transformed bucket.

Infrastructure that wires the real S3 → Lambda → Glue path lives in `infra/index.ts`, where Pulumi creates the buckets, IAM roles, Lambda function, and the S3 notification that points at the handler.

The NestJS application exposes endpoints that let you upload demo data, invoke the Lambda, and query Glue job runs. Sample code for the Lambda handler and the Glue job script is included.

## Project layout

```
.
├── src/
│   ├── app.module.ts              # Root NestJS module
│   ├── main.ts                    # Application bootstrap
│   ├── aws/                       # AWS service wrappers (S3, Lambda, Glue)
│   └── etl/                       # Controllers, DTOs, orchestration logic
├── lambda/handler.ts              # Sample Lambda that starts the Glue job
├── glue/job.py                    # Example Glue ETL script
├── .env.example                   # Environment variables used by the app
└── README.md
```

## Getting started

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment variables**

   Copy `.env.example` to `.env` and update the values to match your AWS account:

   ```bash
   cp .env.example .env
   ```

3. **Run the NestJS app**

   ```bash
   npm run start:dev
   ```

   The API starts on `http://localhost:3000` by default.

## API overview

| Method | Endpoint            | Description                                  |
| ------ | ------------------- | -------------------------------------------- |
| POST   | `/etl/upload`      | Upload raw content to the landing S3 bucket. |
| POST   | `/etl/run`         | Upload content, invoke Lambda, trigger Glue. |
| GET    | `/etl/jobs/:id`    | Fetch status for a Glue job run.             |

### Upload payload

```json
{
  "bucket": "optional-overwrite-bucket",
  "key": "incoming/data.json",
  "content": "{\"name\":\"Alice\"}\n{\"name\":\"Bob\"}",
  "contentType": "application/json"
}
```

### Run pipeline payload

```json
{
  "key": "incoming/data.json",
  "content": "{\"name\":\"Alice\"}\n{\"name\":\"Bob\"}",
  "outputBucket": "etl-transformed-bucket",
  "metadata": {
    "source": "demo"
  }
}
```

The controller returns the bucket/key that was uploaded, the S3 event structure sent to the Lambda, and the Glue job run ID.

## AWS resources to create

You can provision the infrastructure manually or with the Pulumi project under `infra/`. At minimum you need S3 landing/transformed buckets, the Lambda trigger, a Glue job, and IAM roles that allow the components to interact.

## Pulumi deployment

The `infra/` folder contains a Pulumi TypeScript program that deploys everything the diagram shows: buckets, Lambda trigger, Glue job, IAM roles, and the S3 event notification wiring.

### Prerequisites
- AWS CLI configured with credentials for the target account (`aws configure` or environment variables)
- `pulumi` CLI installed (see [Pulumi installs](https://www.pulumi.com/docs/install/))
- `npm` ≥ 8 and Node.js ≥ 18

### Configure and deploy
1. Install dependencies and log in to Pulumi (e.g. `pulumi login --local` or your preferred backend):

   ```bash
   cd infra
   npm install
   pulumi login
   ```

2. Create or select a stack (use `dev` as an example) and set optional config values:

   ```bash
   pulumi stack init dev   # skip if the stack already exists
   pulumi config set etl:landingBucketName your-landing-bucket-name --stack dev
   pulumi config set etl:transformedBucketName your-transformed-bucket --stack dev
   pulumi config set etl:lambdaFunctionName etl-trigger --stack dev
   pulumi config set etl:glueJobName etl-demo-job --stack dev
   ```

   Empty values fall back to auto-generated names, so you can omit any of the settings above.

3. Preview and deploy:

   ```bash
   pulumi preview   # optional but recommended
   pulumi up
   ```

The deployment outputs the bucket names, Lambda function, and Glue job. Resources are tagged and created with `forceDestroy` so they can be torn down easily during experimentation.

### Tear down
- Destroy the stack when you are done:

  ```bash
  pulumi destroy
  ```

Once the Pulumi stack is deployed, the NestJS app can drive the pipeline end-to-end.

## Local development tips

- The `run` endpoint invokes the Lambda asynchronously *and* triggers the Glue job directly. This keeps the pipeline observable during local development even if the Lambda is not deployed yet.
- Replace the AWS SDK clients with `@aws-sdk/client-*` mocks or tools like [LocalStack](https://www.localstack.cloud/) if you want to run everything locally.
- Extend the DTOs and services to add validation, error handling, or additional metadata relevant to your use case.

## Next steps

- Package the Lambda handler using esbuild or webpack before deploying.
- Expand the Pulumi stack with VPC networking, CI/CD, or additional Glue crawlers.
- Add persistence to record executed job runs and expose them through NestJS.
