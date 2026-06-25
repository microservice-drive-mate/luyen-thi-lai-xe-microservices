# ============================================================
# staging-start.ps1
# Khởi động lại môi trường Staging trên Azure để chuẩn bị demo.
#
# Usage:
#   .\scripts\staging-start.ps1
#
# Quy trình:
#   1. Start AKS Cluster (aks-lttl-staging)
#   2. Đợi tất cả pods sẵn sàng
#   3. Hướng dẫn port-forward để truy cập Grafana/Prometheus
#
# Sau khi start:
#   - API Gateway: http://api.52.139.233.166.nip.io
#   - Keycloak:    http://auth.52.139.233.166.nip.io
#   - Grafana:     kubectl port-forward svc/luyen-thi-lai-xe-grafana 30000:3000 -n staging
#   - Prometheus:  kubectl port-forward svc/luyen-thi-lai-xe-prometheus 9090:9090 -n staging
# ============================================================

param(
  [string]$ResourceGroup = "rg-lttl-staging-sea",
  [string]$AksCluster = "aks-lttl-staging",
  [string]$Namespace = "staging",
  [int]$WaitTimeoutSeconds = 300
)

$ErrorActionPreference = "Stop"

function Write-Step { param([string]$Msg) Write-Host "`n>>> $Msg" -ForegroundColor Cyan }
function Write-Ok   { param([string]$Msg) Write-Host "    [OK] $Msg" -ForegroundColor Green }
function Write-Warn { param([string]$Msg) Write-Host "    [!!] $Msg" -ForegroundColor Yellow }
function Write-Info { param([string]$Msg) Write-Host "         $Msg" -ForegroundColor Gray }

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

if ($currentState -eq "Running") {
  Write-Warn "Cluster '$AksCluster' đã đang chạy (Running). Bỏ qua bước start."
} else {
  Write-Step "Đang khởi động AKS cluster '$AksCluster'..."
  Write-Warn "Quá trình này mất 5-10 phút, vui lòng đợi..."
  az aks start --name $AksCluster --resource-group $ResourceGroup
  Write-Ok "AKS cluster '$AksCluster' đã được khởi động!"
}

Write-Step "Cập nhật kubeconfig để kết nối tới cluster..."
az aks get-credentials --name $AksCluster --resource-group $ResourceGroup --overwrite-existing
Write-Ok "Kubeconfig đã được cập nhật."

Write-Step "Đợi tất cả pods trong namespace '$Namespace' sẵn sàng (timeout: ${WaitTimeoutSeconds}s)..."
$deadline = (Get-Date).AddSeconds($WaitTimeoutSeconds)
$allReady = $false

while ((Get-Date) -lt $deadline) {
  $pods = kubectl get pods -n $Namespace --no-headers 2>$null
  if (-not $pods) {
    Write-Info "Chưa có pods nào. Đợi thêm 15s..."
    Start-Sleep 15
    continue
  }

  $notReady = $pods | Where-Object { $_ -notmatch "\s+Running\s+" -or $_ -match "0/[0-9]+" } | Where-Object { $_ -notmatch "Completed" }
  
  if ($notReady.Count -eq 0) {
    $allReady = $true
    break
  }

  $readyCount = ($pods | Where-Object { $_ -match "\s+Running\s+" -and $_ -notmatch "0/[0-9]+" }).Count
  $totalCount = ($pods | Measure-Object -Line).Lines
  Write-Info "Pods sẵn sàng: $readyCount / $totalCount. Đợi thêm 15s..."
  Start-Sleep 15
}

if ($allReady) {
  Write-Ok "Tất cả pods đã sẵn sàng!"
} else {
  Write-Warn "Timeout! Một số pods chưa sẵn sàng. Kiểm tra thủ công bằng: kubectl get pods -n $Namespace"
}

Write-Step "Trạng thái pods hiện tại:"
kubectl get pods -n $Namespace

Write-Host ""
Write-Host "============================================================" -ForegroundColor DarkGray
Write-Host "  Staging đã KHỞI ĐỘNG. Các endpoint truy cập:" -ForegroundColor White
Write-Host ""
Write-Host "  API Gateway:  http://api.52.139.233.166.nip.io" -ForegroundColor Yellow
Write-Host "  Keycloak:     http://auth.52.139.233.166.nip.io" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Để truy cập Grafana/Prometheus (cần port-forward):" -ForegroundColor White
Write-Host "    kubectl port-forward svc/luyen-thi-lai-xe-grafana 30000:3000 -n staging" -ForegroundColor Yellow
Write-Host "    kubectl port-forward svc/luyen-thi-lai-xe-prometheus 9090:9090 -n staging" -ForegroundColor Yellow
Write-Host "    kubectl port-forward svc/luyen-thi-lai-xe-alertmanager 9093:9093 -n staging" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Để đồng bộ DORA Metrics lên Staging (nếu có dữ liệu mới):" -ForegroundColor White
Write-Host "    kubectl create configmap luyen-thi-lai-xe-dora-metrics --from-file=metrics=reports/dora/dora.prom -n staging --dry-run=client -o yaml | kubectl apply -f -" -ForegroundColor Yellow
Write-Host "    kubectl delete pod luyen-thi-lai-xe-prometheus-0 -n staging" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Để tắt staging sau khi demo xong:" -ForegroundColor White
Write-Host "    .\scripts\staging-stop.ps1" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor DarkGray
Write-Host ""
