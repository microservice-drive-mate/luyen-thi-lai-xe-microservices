output "resource_group_name" {
  description = "Azure Resource Group name."
  value       = module.azure_aks.resource_group_name
}

output "aks_cluster_name" {
  description = "AKS cluster name."
  value       = module.azure_aks.aks_cluster_name
}

output "storage_account_name" {
  description = "Azure Storage Account name used by media-service."
  value       = module.azure_aks.storage_account_name
}

output "storage_container_name" {
  description = "Azure Blob container name used by media-service."
  value       = module.azure_aks.storage_container_name
}

output "storage_account_primary_access_key" {
  description = "Primary Storage Account key. Store in GitHub secret STAGING_STORAGE_ACCOUNT_KEY."
  value       = module.azure_aks.storage_account_primary_access_key
  sensitive   = true
}

output "get_credentials_command" {
  description = "Command to configure kubectl for this AKS cluster."
  value       = module.azure_aks.get_credentials_command
}
