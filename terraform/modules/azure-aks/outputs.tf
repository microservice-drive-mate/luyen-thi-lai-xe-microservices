output "resource_group_name" {
  description = "Azure Resource Group name."
  value       = azurerm_resource_group.main.name
}

output "aks_cluster_name" {
  description = "AKS cluster name."
  value       = azurerm_kubernetes_cluster.main.name
}

output "aks_kubelet_identity_object_id" {
  description = "AKS kubelet identity object id."
  value       = try(azurerm_kubernetes_cluster.main.kubelet_identity[0].object_id, null)
}

output "storage_account_name" {
  description = "Azure Storage Account name used by media-service."
  value       = azurerm_storage_account.media.name
}

output "storage_container_name" {
  description = "Azure Blob container name used by media-service."
  value       = azurerm_storage_container.media.name
}

output "storage_account_primary_access_key" {
  description = "Primary Storage Account key. Store in GitHub secret STAGING_STORAGE_ACCOUNT_KEY."
  value       = azurerm_storage_account.media.primary_access_key
  sensitive   = true
}

output "get_credentials_command" {
  description = "Command to configure kubectl for this AKS cluster."
  value       = "az aks get-credentials --resource-group ${azurerm_resource_group.main.name} --name ${azurerm_kubernetes_cluster.main.name} --overwrite-existing"
}
