# NestJS ETL Pipeline Demo

This project showcases a minimal ETL pipeline built with NestJS and AWS services (S3, Lambda, and Glue). It follows the flow shown in the provided diagram:

1. A file is uploaded to an S3 **landing** bucket, where the NestJS API can enrich the object with metadata (such as source and timestamp) and enforce a folder structure for raw data ingestion.
2. The S3 `ObjectCreated` event invokes a Lambda function that logs the event payload, performs lightweight validation (file type, presence of metadata), and assembles the parameters required to start a downstream transformation.
3. The Lambda function then triggers an AWS Glue job, injecting the source bucket/key, the destination bucket, and any contextual arguments so Glue can locate the raw file and persist results under a predictable prefix.
4. The Glue job reads the raw records, applies transformations (e.g., normalising fields, deriving uppercase names, tagging each record as processed), and writes the enriched dataset to the **transformed** S3 bucket ready for analytics or further pipelines.

The NestJS application focuses on orchestrating and observing this pipeline. It exposes endpoints that let you upload demo data, invoke the Lambda, and query Glue job runs. Sample code for the Lambda handler and the Glue job script is included.

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
