variable "aws_region" {
  description = "AWS region to deploy resources into"
  type        = string
  default     = "us-east-1"
}

variable "vpc_id" {
  description = "VPC ID for the EC2 instance and security groups"
  type        = string
}

variable "subnet_id" {
  description = "Subnet ID for the EC2 instance"
  type        = string
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3.micro"
}

variable "key_name" {
  description = "Existing EC2 Key Pair name for SSH access (set null to disable)"
  type        = string
  default     = null
}

variable "ami_id" {
  description = "Override AMI ID. If null, latest Amazon Linux 2023 is used"
  type        = string
  default     = null
}

variable "allow_ssh_cidr" {
  description = "CIDR allowed to SSH to the instance"
  type        = string
  default     = "0.0.0.0/0"
}

variable "allow_app_cidr" {
  description = "CIDR allowed to access the application port"
  type        = string
  default     = "0.0.0.0/0"
}

variable "app_port" {
  description = "Application port to expose on the security group"
  type        = number
  default     = 3000
}

variable "tags" {
  description = "Common tags applied to all resources"
  type        = map(string)
  default     = {}
}


