variable "project_name" {
  description = "Short project slug used in Azure resource names."
  type        = string
  default     = "lttl"

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

variable "location" {
  description = "Azure region for the demo stack."
  type        = string
  default     = "southeastasia"
}

variable "resource_group_name" {
  description = "Azure Resource Group name. Leave empty to derive one from project/environment."
  type        = string
  default     = ""
}

variable "aks_cluster_name" {
  description = "AKS cluster name. Leave empty to derive one from project/environment."
  type        = string
  default     = ""
}

variable "kubernetes_version" {
  description = "Optional AKS Kubernetes version. Empty lets Azure choose the default."
  type        = string
  default     = ""
}

variable "node_count" {
  description = "Initial node count for the system node pool."
  type        = number
  default     = 1
}

variable "node_vm_size" {
  description = "VM size for the AKS system node pool."
  type        = string
  default     = "Standard_D4s_v4"
}

variable "node_os_disk_size_gb" {
  description = "OS disk size for AKS nodes."
  type        = number
  default     = 128
}

variable "enable_auto_scaling" {
  description = "Whether to enable cluster autoscaling for the system node pool."
  type        = bool
  default     = false
}

variable "min_node_count" {
  description = "Minimum nodes when autoscaling is enabled."
  type        = number
  default     = 1
}

variable "max_node_count" {
  description = "Maximum nodes when autoscaling is enabled."
  type        = number
  default     = 2
}

variable "app_node_pool_enabled" {
  description = "Create a separate user node pool for application workloads."
  type        = bool
  default     = true
}

variable "app_node_count" {
  description = "Node count for the application user node pool."
  type        = number
  default     = 1
}

variable "app_node_vm_size" {
  description = "VM size for the application user node pool."
  type        = string
  default     = "Standard_B2s_v2"
}

variable "app_node_os_disk_size_gb" {
  description = "OS disk size for application user node pool nodes."
  type        = number
  default     = 64
}

variable "storage_account_name" {
  description = "Globally unique Azure Storage Account name for media blobs."
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9]{3,24}$", var.storage_account_name))
    error_message = "storage_account_name must be 3-24 lowercase letters/numbers."
  }
}

variable "storage_container_name" {
  description = "Blob container used by media-service."
  type        = string
  default     = "media"
}

variable "blob_cors_allowed_origins" {
  description = "Frontend origins allowed to PUT/GET directly against Azure Blob Storage."
  type        = list(string)
  default = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
  ]
}

variable "enable_log_analytics" {
  description = "Enable Azure Log Analytics workspace and AKS OMS agent."
  type        = bool
  default     = true
}

variable "common_tags" {
  description = "Tags applied to Azure resources."
  type        = map(string)
  default = {
    app        = "luyen-thi-lai-xe"
    managed_by = "terraform"
  }
}
