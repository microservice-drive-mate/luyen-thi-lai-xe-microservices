module "azure_aks" {
  source = "../modules/azure-aks"

  project_name              = var.project_name
  environment               = var.environment
  location                  = var.location
  resource_group_name       = var.resource_group_name
  aks_cluster_name          = var.aks_cluster_name
  kubernetes_version        = var.kubernetes_version
  node_count                = var.node_count
  node_vm_size              = var.node_vm_size
  node_os_disk_size_gb      = var.node_os_disk_size_gb
  enable_auto_scaling       = var.enable_auto_scaling
  min_node_count            = var.min_node_count
  max_node_count            = var.max_node_count
  app_node_pool_enabled     = var.app_node_pool_enabled
  app_node_count            = var.app_node_count
  app_node_vm_size          = var.app_node_vm_size
  app_node_os_disk_size_gb  = var.app_node_os_disk_size_gb
  storage_account_name      = var.storage_account_name
  storage_container_name    = var.storage_container_name
  blob_cors_allowed_origins = var.blob_cors_allowed_origins
  enable_log_analytics      = var.enable_log_analytics
  common_tags               = var.common_tags
}
