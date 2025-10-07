# NestJS ETL Pipeline Demo

This project showcases a minimal ETL pipeline built with NestJS and AWS services (S3, Lambda, and Glue). It follows the flow shown in the provided diagram:

1. A file is uploaded to an S3 **landing** bucket.
2. The S3 `ObjectCreated` event invokes a Lambda function.
3. The Lambda function triggers an AWS Glue job.
4. The Glue job processes the file and writes the transformed data to a second S3 bucket.

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

You can provision the infrastructure manually or with your preferred IaC solution. At minimum you need:

1. **S3 buckets**
   - Landing bucket (`AWS_SOURCE_BUCKET`)
   - Transformed bucket (`AWS_TRANSFORMED_BUCKET`)

2. **Lambda function**
   - Runtime: `nodejs18.x`
   - Handler: `index.handler` (build `lambda/handler.ts` to JavaScript and upload it)
   - Environment variables: `AWS_REGION`, `AWS_GLUE_JOB_NAME`, `AWS_TRANSFORMED_BUCKET`
   - IAM permissions: `s3:GetObject`, `glue:StartJobRun`
   - Trigger: S3 `ObjectCreated` events from the landing bucket

3. **Glue job**
   - Script: `glue/job.py`
   - Arguments passed by the Lambda: `--SOURCE_BUCKET`, `--SOURCE_KEY`, `--OUTPUT_BUCKET`
   - IAM role: permissions for reading the landing bucket and writing to the transformed bucket

4. **IAM roles**
   - NestJS application credentials need access to S3, Lambda invocation, and Glue job execution.

Once the resources exist, the NestJS app can be used to upload demo data and observe the full ETL flow.

## Local development tips

- The `run` endpoint invokes the Lambda asynchronously *and* triggers the Glue job directly. This keeps the pipeline observable during local development even if the Lambda is not deployed yet.
- Replace the AWS SDK clients with `@aws-sdk/client-*` mocks or tools like [LocalStack](https://www.localstack.cloud/) if you want to run everything locally.
- Extend the DTOs and services to add validation, error handling, or additional metadata relevant to your use case.

## Next steps

- Package the Lambda handler using esbuild or webpack before deploying.
- Automate the infrastructure with CDK, Terraform, or the Serverless Framework.
- Add persistence to record executed job runs and expose them through NestJS.
