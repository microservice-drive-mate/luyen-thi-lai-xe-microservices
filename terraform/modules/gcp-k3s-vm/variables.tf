variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "region" {
  type = string
}

variable "zone" {
  type = string
}

variable "machine_type" {
  type = string
}

variable "boot_disk_size_gb" {
  type = number
}

variable "boot_disk_type" {
  type = string
}

variable "image" {
  type = string
}

variable "ssh_user" {
  type = string
}

variable "ssh_public_key_path" {
  type = string
}

variable "allowed_admin_cidrs" {
  type = list(string)
}

variable "k3s_version" {
  type = string
}

variable "network_cidr" {
  type = string
}

variable "common_labels" {
  type = map(string)
}
