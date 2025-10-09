# NestJS ETL Pipeline Demo

This project showcases a minimal ETL pipeline built with NestJS and AWS services (S3, Lambda, and Glue).

### End-to-end flow (with code pointers)
- NestJS exposes `/etl/upload` and `/etl/run` (`src/etl/etl.controller.ts`), and both delegate to `EtlService` (`src/etl/etl.service.ts`). The service forwards the request payload to the ingest Lambda via `LambdaService.invokeIngestLambda` (`src/aws/lambda.service.ts`), using the configured function name (`aws.ingestLambdaFunctionName`).
- The ingest Lambda (`lambda/ingest-handler.ts`) writes the object into the landing bucket, preserving any metadata from the request and storing an optional `pipeline-output-bucket` hint so downstream stages can override the default destination.
- S3 emits an `ObjectCreated` notification that triggers the processor Lambda (`lambda/handler.ts`). That function loads object metadata with `HeadObjectCommand`, chooses the destination bucket, and starts the Glue job through `StartJobRunCommand`.
- The Glue script at `glue/job.py` reads the raw records, enriches them, and writes the transformed dataset to the resolved bucket/prefix.

Infrastructure that wires the real S3 → Lambda → Glue path lives in `infra/index.ts`, where Pulumi creates the buckets, IAM roles, both Lambda functions, and the S3 notification that points at the processor handler.

The NestJS application exposes endpoints that let you upload demo data, invoke the Lambda, and query Glue job runs. Sample code for the Lambda handler and the Glue job script is included.

## Project layout

```
.
├── src/
│   ├── app.module.ts              # Root NestJS module
│   ├── main.ts                    # Application bootstrap
│   ├── aws/                       # AWS service wrappers (S3, Lambda, Glue)
│   └── etl/                       # Controllers, DTOs, orchestration logic
├── lambda/ingest-handler.ts       # Lambda that uploads payloads into the landing bucket
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

The controller responds with the bucket/key plus the Lambda request ID that accepted the ingestion. The Glue job starts asynchronously after the S3 notification fires; capture the job run ID from the processor Lambda logs and query `/etl/jobs/:id` when you need status. Custom `outputBucket` and `metadata` values travel with the object as S3 metadata so the processor Lambda can adjust the Glue invocation.

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
   pulumi config set etl:ingestLambdaFunctionName etl-ingest --stack dev
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

- Both `/etl/upload` and `/etl/run` delegate to the ingest Lambda; watch the ingest and processor Lambda logs to follow the asynchronous chain and capture Glue job run IDs as they are emitted.
- Replace the AWS SDK clients with `@aws-sdk/client-*` mocks or tools like [LocalStack](https://www.localstack.cloud/) if you want to run everything locally.
- Extend the DTOs and services to add validation, error handling, or additional metadata relevant to your use case.

## Next steps

- Package the Lambda handlers using esbuild or webpack before deploying.
- Expand the Pulumi stack with VPC networking, CI/CD, or additional Glue crawlers.
- Add persistence to record executed job runs and expose them through NestJS.
