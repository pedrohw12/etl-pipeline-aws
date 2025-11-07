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

## AWS deployment with Terraform (EC2 + Security Groups)

The `infra/terraform` folder contains a Terraform configuration that provisions an EC2 instance and security groups suitable for running this NestJS app.

### What it creates
- An EC2 instance in your specified VPC/subnet
- A security group allowing SSH (22) and your app port (default 3000)
- Outputs with the instance ID, public IP, and public DNS

### Prerequisites
- AWS CLI configured with credentials for the target account (`aws configure`) or environment variables
- Terraform CLI ≥ 1.5 (`brew install terraform` on macOS)
- An existing VPC and a public subnet ID
- Optional: an existing EC2 Key Pair for SSH access

### Configure variables
Copy the example variables and set values:

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars
# edit terraform.tfvars with your VPC ID, subnet ID, key_name, etc.
```

Key variables:
- `vpc_id`: target VPC
- `subnet_id`: public subnet for the instance
- `key_name`: existing EC2 key pair name (set to null to disable SSH)
- `app_port`: application port to open (defaults to 3000)

### Build and deploy

```bash
terraform init
terraform plan
terraform apply -auto-approve
```

Outputs show `public_ip` and `public_dns`. If you opened `app_port` to the world, the app will be reachable once your process is running on the instance.

### User data bootstrap
The instance runs `infra/terraform/user_data.sh` on first boot. By default it installs Node.js and PM2. Customize the script to deploy your app (clone from Git, pull from S3/ECR, etc.), then start it, e.g. `pm2 start "npm run start:prod"`.

### SSH access
If you set `key_name` and allowed your IP in `allow_ssh_cidr`:

```bash
ssh -i /path/to/your.pem ec2-user@$(terraform output -raw public_dns)
```

### Tear down

```bash
terraform destroy -auto-approve
```

Note: The previous Pulumi-based setup remains in `infra/` but is no longer the primary deployment path.

## Local development tips

- Both `/etl/upload` and `/etl/run` delegate to the ingest Lambda; watch the ingest and processor Lambda logs to follow the asynchronous chain and capture Glue job run IDs as they are emitted.
- Replace the AWS SDK clients with `@aws-sdk/client-*` mocks or tools like [LocalStack](https://www.localstack.cloud/) if you want to run everything locally.
- Extend the DTOs and services to add validation, error handling, or additional metadata relevant to your use case.

## Next steps

- Package the Lambda handlers using esbuild or webpack before deploying.
- Expand the Pulumi stack with VPC networking, CI/CD, or additional Glue crawlers.
- Add persistence to record executed job runs and expose them through NestJS.
