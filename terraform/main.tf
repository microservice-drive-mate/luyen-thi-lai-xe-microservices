module "gcp_k3s_vm" {
  source = "./modules/gcp-k3s-vm"

  project_name        = var.project_name
  environment         = var.environment
  region              = var.region
  zone                = var.zone
  machine_type        = var.machine_type
  boot_disk_size_gb   = var.boot_disk_size_gb
  boot_disk_type      = var.boot_disk_type
  image               = var.image
  ssh_user            = var.ssh_user
  ssh_public_key_path = var.ssh_public_key_path
  allowed_admin_cidrs = var.allowed_admin_cidrs
  k3s_version         = var.k3s_version
  network_cidr        = var.network_cidr
  common_labels       = var.common_labels
}
