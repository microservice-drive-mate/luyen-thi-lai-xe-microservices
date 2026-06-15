locals {
  name_prefix         = "${var.project_name}-${var.environment}"
  resource_group_name = var.resource_group_name != "" ? var.resource_group_name : "rg-${local.name_prefix}-sea"
  aks_cluster_name    = var.aks_cluster_name != "" ? var.aks_cluster_name : "aks-${local.name_prefix}"
  tags = merge(var.common_tags, {
    environment = var.environment
    cloud       = "azure"
  })
}

resource "azurerm_resource_group" "main" {
  name     = local.resource_group_name
  location = var.location
  tags     = local.tags
}

resource "azurerm_log_analytics_workspace" "main" {
  count               = var.enable_log_analytics ? 1 : 0
  name                = "law-${local.name_prefix}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  sku                 = "PerGB2018"
  retention_in_days   = 30
  tags                = local.tags
}

resource "azurerm_kubernetes_cluster" "main" {
  name                = local.aks_cluster_name
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  dns_prefix          = local.aks_cluster_name
  kubernetes_version  = var.kubernetes_version != "" ? var.kubernetes_version : null
  sku_tier            = "Free"
  tags                = local.tags

  default_node_pool {
    name                 = "system"
    vm_size              = var.node_vm_size
    node_count           = var.enable_auto_scaling ? null : var.node_count
    auto_scaling_enabled = var.enable_auto_scaling
    min_count            = var.enable_auto_scaling ? var.min_node_count : null
    max_count            = var.enable_auto_scaling ? var.max_node_count : null
    os_disk_size_gb      = var.node_os_disk_size_gb
    type                 = "VirtualMachineScaleSets"
    temporary_name_for_rotation = "systmp"
  }

  identity {
    type = "SystemAssigned"
  }

  network_profile {
    network_plugin    = "azure"
    load_balancer_sku = "standard"
  }

  dynamic "oms_agent" {
    for_each = var.enable_log_analytics ? [1] : []
    content {
      log_analytics_workspace_id = azurerm_log_analytics_workspace.main[0].id
    }
  }
}

resource "azurerm_kubernetes_cluster_node_pool" "app" {
  count                 = var.app_node_pool_enabled ? 1 : 0
  name                  = "app"
  kubernetes_cluster_id = azurerm_kubernetes_cluster.main.id
  mode                  = "User"
  vm_size               = var.app_node_vm_size
  node_count            = var.app_node_count
  os_disk_size_gb       = var.app_node_os_disk_size_gb
  tags                  = local.tags
}

resource "azurerm_storage_account" "media" {
  name                            = var.storage_account_name
  resource_group_name             = azurerm_resource_group.main.name
  location                        = azurerm_resource_group.main.location
  account_tier                    = "Standard"
  account_replication_type        = "LRS"
  allow_nested_items_to_be_public = false
  min_tls_version                 = "TLS1_2"
  tags                            = local.tags

  blob_properties {
    cors_rule {
      allowed_headers    = ["*"]
      allowed_methods    = ["GET", "HEAD", "OPTIONS", "PUT"]
      allowed_origins    = var.blob_cors_allowed_origins
      exposed_headers    = ["*"]
      max_age_in_seconds = 3600
    }
  }
}

resource "azurerm_storage_container" "media" {
  name                  = var.storage_container_name
  storage_account_id    = azurerm_storage_account.media.id
  container_access_type = "private"
}
