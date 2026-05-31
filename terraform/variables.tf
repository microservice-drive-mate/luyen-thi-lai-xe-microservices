variable "project_id" {
  description = "GCP project ID that owns the Phase 9 infrastructure."
  type        = string

  validation {
    condition     = length(var.project_id) > 0
    error_message = "project_id is required."
  }
}

variable "project_name" {
  description = "Short project slug used in GCP resource names."
  type        = string
  default     = "luyen-thi-lai-xe"

  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.project_name))
    error_message = "project_name may contain lowercase letters, numbers, and hyphens only."
  }
}

variable "environment" {
  description = "Deployment environment name."
  type        = string
  default     = "staging"

  validation {
    condition     = contains(["dev", "staging", "production"], var.environment)
    error_message = "environment must be dev, staging, or production."
  }
}

variable "region" {
  description = "GCP region. Singapore is the Phase 9 default."
  type        = string
  default     = "asia-southeast1"
}

variable "zone" {
  description = "GCP zone for the single-node K3s VM."
  type        = string
  default     = "asia-southeast1-b"
}

variable "machine_type" {
  description = "Compute Engine machine type for the K3s VM."
  type        = string
  default     = "e2-standard-8"
}

variable "boot_disk_size_gb" {
  description = "Boot disk size in GB."
  type        = number
  default     = 150

  validation {
    condition     = var.boot_disk_size_gb >= 100
    error_message = "boot_disk_size_gb should be at least 100 for this stack."
  }
}

variable "boot_disk_type" {
  description = "Boot disk type."
  type        = string
  default     = "pd-balanced"
}

variable "image" {
  description = "GCP source image for the VM."
  type        = string
  default     = "ubuntu-os-cloud/ubuntu-2204-lts"
}

variable "ssh_user" {
  description = "Linux user created by GCE metadata SSH keys."
  type        = string
  default     = "ubuntu"
}

variable "ssh_public_key_path" {
  description = "Path to the SSH public key to inject into the VM."
  type        = string
  default     = "~/.ssh/id_rsa.pub"
}

variable "allowed_admin_cidrs" {
  description = "CIDR blocks allowed to reach SSH and the Kubernetes API."
  type        = list(string)
  default     = []

  validation {
    condition     = length(var.allowed_admin_cidrs) > 0
    error_message = "Set allowed_admin_cidrs to your public IP/CIDR, for example [\"203.0.113.10/32\"]."
  }
}

variable "k3s_version" {
  description = "K3s version installed by the VM startup script."
  type        = string
  default     = "v1.29.4+k3s1"
}

variable "network_cidr" {
  description = "Subnet CIDR for the dedicated Phase 9 VPC."
  type        = string
  default     = "10.90.0.0/24"
}

variable "common_labels" {
  description = "Labels applied to GCP resources."
  type        = map(string)
  default = {
    app        = "luyen-thi-lai-xe"
    phase      = "phase-9"
    managed_by = "terraform"
  }
}
