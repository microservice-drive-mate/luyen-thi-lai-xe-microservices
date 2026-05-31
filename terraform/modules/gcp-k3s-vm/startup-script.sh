#!/usr/bin/env bash
set -euxo pipefail

export DEBIAN_FRONTEND=noninteractive

apt-get update -y
apt-get install -y \
  apt-transport-https \
  ca-certificates \
  curl \
  git \
  htop \
  jq \
  unzip \
  wget

cat >/etc/sysctl.d/99-kubernetes.conf <<'SYSCTL'
net.ipv4.ip_forward = 1
net.ipv6.conf.all.forwarding = 1
net.netfilter.nf_conntrack_max = 262144
vm.swappiness = 10
vm.overcommit_memory = 1
SYSCTL
sysctl --system

curl -sfL https://get.k3s.io | \
  INSTALL_K3S_VERSION='${k3s_version}' \
  INSTALL_K3S_EXEC='server --tls-san ${public_ip} --write-kubeconfig-mode 644' \
  sh -

for i in $(seq 1 60); do
  if kubectl get nodes --no-headers 2>/dev/null | grep -q ' Ready'; then
    break
  fi
  sleep 10
done

kubectl get nodes -o wide
kubectl get pods -A
