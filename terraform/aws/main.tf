provider "aws" {
  region = var.aws_region
}

# 1. VPC and Subnets
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"

  name = "hiredright-vpc"
  cidr = "10.0.0.0/16"

  azs             = ["${var.aws_region}a", "${var.aws_region}b"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24"]

  enable_nat_gateway = true
  single_nat_gateway = true
}

# 2. EKS Cluster (Kubernetes)
module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.0"

  cluster_name    = "hiredright-cluster"
  cluster_version = "1.30"
  
  vpc_id                   = module.vpc.vpc_id
  subnet_ids               = module.vpc.private_subnets
  control_plane_subnet_ids = module.vpc.public_subnets

  eks_managed_node_groups = {
    hiredright_nodes = {
      min_size     = 2
      max_size     = 5
      desired_size = 2
      instance_types = ["t3.medium"]
    }
  }
}

# 3. RDS PostgreSQL
module "db" {
  source  = "terraform-aws-modules/rds/aws"
  version = "~> 6.0"

  identifier = "hiredright-db"

  engine               = "postgres"
  engine_version       = "15"
  family               = "postgres15"
  major_engine_version = "15"
  instance_class       = "db.t4g.micro"

  allocated_storage = 20

  db_name  = "hiredright"
  username = "hiredright_admin"
  port     = 5432

  vpc_security_group_ids = [aws_security_group.db.id]
  create_db_subnet_group = true
  subnet_ids             = module.vpc.private_subnets
}

# (Optional) Add S3 Bucket and ElastiCache here based on requirements.
