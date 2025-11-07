data "aws_ami" "al2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }

  filter {
    name   = "architecture"
    values = ["x86_64"]
  }
}

locals {
  selected_ami = coalesce(var.ami_id, data.aws_ami.al2023.id)
}

resource "aws_instance" "app" {
  ami                    = local.selected_ami
  instance_type          = var.instance_type
  subnet_id              = var.subnet_id
  vpc_security_group_ids = [aws_security_group.app_sg.id]
  key_name               = var.key_name

  user_data = file("${path.module}/user_data.sh")

  tags = merge({
    Name = "portfolio-app-ec2"
  }, var.tags)
}


