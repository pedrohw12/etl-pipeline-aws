import sys
import json
import boto3
from awsglue.utils import getResolvedOptions

# Glue receives SOURCE/OUTPUT arguments from either the Lambda handler or local runs.
# The script reads the raw object, enriches it, and writes results back to S3.

args = getResolvedOptions(
    sys.argv,
    ["SOURCE_BUCKET", "SOURCE_KEY", "OUTPUT_BUCKET"],
)

s3 = boto3.client("s3")

source_bucket = args["SOURCE_BUCKET"]
source_key = args["SOURCE_KEY"]
output_bucket = args["OUTPUT_BUCKET"]
output_key = f"transformed/{source_key}"

print(f"Reading s3://{source_bucket}/{source_key}")
response = s3.get_object(Bucket=source_bucket, Key=source_key)
body = response["Body"].read().decode("utf-8")

records = [json.loads(line) for line in body.splitlines() if line.strip()]

transformed = [
    {
        **record,
        "processed": True,
        "uppercase_name": record.get("name", "").upper(),
    }
    for record in records
]

output_body = "\n".join(json.dumps(record) for record in transformed)

print(f"Writing transformed data to s3://{output_bucket}/{output_key}")
s3.put_object(
    Bucket=output_bucket,
    Key=output_key,
    Body=output_body.encode("utf-8"),
    ContentType="application/json",
)

print("Transformation complete")
