# ============================================================
# staging-stop.ps1
# Tắt toàn bộ môi trường Staging trên Azure để tiết kiệm chi phí.
#
# Usage:
#   .\scripts\staging-stop.ps1
#
# Tài nguyên được tắt:
#   - AKS Cluster (aks-lttl-staging) — tiết kiệm chi phí VM nodes
#
# Lưu ý:
#   - Azure vẫn tính phí lưu trữ (PVC/Disk) và Static IP khi cluster đã stop.
#   - Keycloak, Kong, Prometheus, Grafana, RabbitMQ, tất cả workloads đều tắt.
#   - Dữ liệu trong PVC (PostgreSQL, Prometheus TSDB) vẫn được GIỮ NGUYÊN.
#   - Để start lại: chạy .\scripts\staging-start.ps1
# ============================================================

param(
  [string]$ResourceGroup = "rg-lttl-staging-sea",
  [string]$AksCluster = "aks-lttl-staging"
)

$ErrorActionPreference = "Stop"

function Write-Step { param([string]$Msg) Write-Host "`n>>> $Msg" -ForegroundColor Cyan }
function Write-Ok   { param([string]$Msg) Write-Host "    [OK] $Msg" -ForegroundColor Green }
function Write-Warn { param([string]$Msg) Write-Host "    [!!] $Msg" -ForegroundColor Yellow }

Write-Step "Kiểm tra đăng nhập Azure..."
$account = az account show --query "{name:name, user:user.name}" -o json 2>$null | ConvertFrom-Json
if (-not $account) {
  Write-Host "Chưa đăng nhập Azure. Chạy: az login" -ForegroundColor Red
  exit 1
}
Write-Ok "Đã đăng nhập: $($account.user) / $($account.name)"

Write-Step "Kiểm tra trạng thái AKS cluster '$AksCluster'..."
$clusterJson = az aks show --name $AksCluster --resource-group $ResourceGroup --query "{powerState:powerState.code}" -o json | ConvertFrom-Json
$currentState = $clusterJson.powerState

if ($currentState -eq "Stopped") {
  Write-Warn "Cluster '$AksCluster' đã ở trạng thái Stopped. Không cần làm gì thêm."
  exit 0
}

Write-Step "Đang tắt AKS cluster '$AksCluster'..."
Write-Warn "Quá trình này mất 5-10 phút, vui lòng đợi..."
az aks stop --name $AksCluster --resource-group $ResourceGroup
Write-Ok "AKS cluster '$AksCluster' đã được tắt thành công!"

Write-Host ""
Write-Host "============================================================" -ForegroundColor DarkGray
Write-Host "  Staging đã TẮT. Để khởi động lại khi cần demo:" -ForegroundColor White
Write-Host "    .\scripts\staging-start.ps1" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor DarkGray
Write-Host ""
