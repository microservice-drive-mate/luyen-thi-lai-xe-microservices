locals {
  name_prefix        = "${var.project_name}-${var.environment}"
  network_tag        = "${local.name_prefix}-k3s"
  service_account_id = substr("${replace(var.project_name, "-", "")}-${var.environment}-k3s", 0, 30)
}

resource "google_compute_network" "phase9" {
  name                    = "${local.name_prefix}-network"
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "phase9" {
  name          = "${local.name_prefix}-subnet"
  ip_cidr_range = var.network_cidr
  region        = var.region
  network       = google_compute_network.phase9.id
}

resource "google_compute_address" "k3s" {
  name   = "${local.name_prefix}-ip"
  region = var.region
}

resource "google_service_account" "k3s" {
  account_id   = local.service_account_id
  display_name = "${local.name_prefix} K3s VM"
}

resource "google_compute_firewall" "web" {
  name    = "${local.name_prefix}-allow-web"
  network = google_compute_network.phase9.name

  allow {
    protocol = "tcp"
    ports    = ["80", "443"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = [local.network_tag]
}

resource "google_compute_firewall" "admin" {
  name    = "${local.name_prefix}-allow-admin"
  network = google_compute_network.phase9.name

  allow {
    protocol = "tcp"
    ports    = ["22", "6443"]
  }

  source_ranges = var.allowed_admin_cidrs
  target_tags   = [local.network_tag]
}

resource "google_compute_instance" "k3s" {
  name         = "${local.name_prefix}-k3s"
  machine_type = var.machine_type
  zone         = var.zone
  tags         = [local.network_tag]
  labels       = var.common_labels

  boot_disk {
    initialize_params {
      image = var.image
      size  = var.boot_disk_size_gb
      type  = var.boot_disk_type
    }
  }

  network_interface {
    subnetwork = google_compute_subnetwork.phase9.id

    access_config {
      nat_ip = google_compute_address.k3s.address
    }
  }

  metadata = {
    ssh-keys = "${var.ssh_user}:${file(pathexpand(var.ssh_public_key_path))}"
  }

  metadata_startup_script = templatefile("${path.module}/startup-script.sh", {
    k3s_version = var.k3s_version
    public_ip   = google_compute_address.k3s.address
  })

  service_account {
    email = google_service_account.k3s.email
    scopes = [
      "https://www.googleapis.com/auth/logging.write",
      "https://www.googleapis.com/auth/monitoring.write",
    ]
  }

  allow_stopping_for_update = true
}
