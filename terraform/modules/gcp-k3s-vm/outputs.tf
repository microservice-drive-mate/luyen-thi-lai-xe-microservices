output "vm_name" {
  value = google_compute_instance.k3s.name
}

output "zone" {
  value = var.zone
}

output "public_ip" {
  value = google_compute_address.k3s.address
}

output "api_host" {
  value = "api.${google_compute_address.k3s.address}.nip.io"
}

output "auth_host" {
  value = "auth.${google_compute_address.k3s.address}.nip.io"
}

output "ssh_command" {
  value = "ssh ${var.ssh_user}@${google_compute_address.k3s.address}"
}

output "kubeconfig_fetch_command_bash" {
  value = "ssh ${var.ssh_user}@${google_compute_address.k3s.address} \"sudo sed 's/127.0.0.1/${google_compute_address.k3s.address}/g' /etc/rancher/k3s/k3s.yaml\" > kubeconfig-gcp.yaml && export KUBECONFIG=$PWD/kubeconfig-gcp.yaml && kubectl get nodes"
}

output "kubeconfig_fetch_command_powershell" {
  value = "ssh ${var.ssh_user}@${google_compute_address.k3s.address} \"sudo sed 's/127.0.0.1/${google_compute_address.k3s.address}/g' /etc/rancher/k3s/k3s.yaml\" | Out-File -Encoding ascii kubeconfig-gcp.yaml; $env:KUBECONFIG = (Resolve-Path .\\kubeconfig-gcp.yaml); kubectl get nodes"
}
