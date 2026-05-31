output "vm_name" {
  description = "Compute Engine VM name."
  value       = module.gcp_k3s_vm.vm_name
}

output "vm_zone" {
  description = "Compute Engine VM zone."
  value       = module.gcp_k3s_vm.zone
}

output "public_ip" {
  description = "Static public IPv4 address."
  value       = module.gcp_k3s_vm.public_ip
}

output "api_host" {
  description = "nip.io API host for Kong/Traefik ingress."
  value       = module.gcp_k3s_vm.api_host
}

output "auth_host" {
  description = "nip.io auth host for Keycloak ingress."
  value       = module.gcp_k3s_vm.auth_host
}

output "ssh_command" {
  description = "SSH command for the VM."
  value       = module.gcp_k3s_vm.ssh_command
}

output "kubeconfig_fetch_command_bash" {
  description = "Bash command to fetch kubeconfig from the VM."
  value       = module.gcp_k3s_vm.kubeconfig_fetch_command_bash
}

output "kubeconfig_fetch_command_powershell" {
  description = "PowerShell command to fetch kubeconfig from the VM."
  value       = module.gcp_k3s_vm.kubeconfig_fetch_command_powershell
}

output "phase9_urls" {
  description = "Public URLs used by Phase 9 tests."
  value = {
    api_base_url = "https://${module.gcp_k3s_vm.api_host}"
    auth_url     = "https://${module.gcp_k3s_vm.auth_host}"
  }
}
