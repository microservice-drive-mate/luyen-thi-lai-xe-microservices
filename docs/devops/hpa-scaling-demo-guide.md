# Kubernetes HPA & Scaling Demo Guide

Hướng dẫn này giúp bạn hiểu và trình diễn Horizontal Pod Autoscaler (HPA) trong môi trường Staging trên Azure AKS.

## Tổng quan kiến trúc Scaling

```
User Traffic → Kong Gateway → Microservices (1–5 pods mỗi service)
                                     ↑
                              HPA controller
                                     ↑
                           metrics-server (CPU/RAM từ kubelet)
```

- **HPA** (`autoscaling/v2`): tự động tăng/giảm replicas dựa trên CPU và Memory
- **metrics-server**: thu thập resource metrics từ kubelet, cung cấp cho HPA
- **Resources**: tất cả services đều có `requests`/`limits` để HPA tính % utilization đúng

---

## 1. Kiểm tra Prerequisites

### 1.1 Verify metrics-server đang chạy

```powershell
kubectl get deployment metrics-server -n kube-system
```

Kết quả mong đợi:
```
NAME             READY   UP-TO-DATE   AVAILABLE
metrics-server   1/1     1            1
```

> [!NOTE]
> Azure AKS tích hợp sẵn metrics-server, không cần cài thủ công. Nếu thiếu, chạy:
> ```powershell
> kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
> ```

### 1.2 Verify metrics đang hoạt động

```powershell
# Resource usage của tất cả nodes
kubectl top nodes

# Resource usage của tất cả pods trong namespace staging
kubectl top pods -n staging --sort-by=cpu
```

Nếu lệnh trên báo `error: Metrics API not available` → metrics-server chưa sẵn sàng, đợi 1–2 phút.

---

## 2. Xem trạng thái HPA hiện tại

### 2.1 Liệt kê tất cả HPA

```powershell
kubectl get hpa -n staging
```

Output mẫu khi hệ thống bình thường (low traffic):
```
NAME                                        TARGETS              MINPODS  MAXPODS  REPLICAS
luyen-thi-lai-xe-identity-service           12%/70%, 18%/80%     2        5        2
luyen-thi-lai-xe-exam-service               8%/70%, 22%/80%      1        4        1
luyen-thi-lai-xe-course-service             5%/70%, 15%/80%      1        3        1
luyen-thi-lai-xe-analytics-service          3%/70%, 10%/80%      1        3        1
luyen-thi-lai-xe-simulation-service         7%/70%, 20%/80%      1        3        1
luyen-thi-lai-xe-user-service               4%/70%, 12%/80%      1        3        1
luyen-thi-lai-xe-question-service           2%/70%, 8%/80%       1        3        1
luyen-thi-lai-xe-notification-service       1%/70%, 5%/80%       1        3        1
luyen-thi-lai-xe-audit-service              1%/70%, 3%/80%       1        2        1
```

Cột **TARGETS** = `current%/target%`. Khi current vượt target → HPA sẽ scale up.

### 2.2 Xem chi tiết một HPA

```powershell
kubectl describe hpa luyen-thi-lai-xe-exam-service -n staging
```

Các phần quan trọng:
- **Current Metrics**: CPU/Memory thực tế
- **Conditions**: `AbleToScale`, `ScalingActive`, `ScalingLimited`
- **Events**: lịch sử scale up/down với lý do cụ thể

---

## 3. Demo Manual Scaling

Trước khi demo HPA tự động, show manual scaling để người nghe hiểu concept:

### 3.1 Scale up thủ công

```powershell
# Scale exam-service lên 3 replicas
kubectl scale deployment luyen-thi-lai-xe-exam-service --replicas=3 -n staging

# Quan sát pods được tạo trong real-time
kubectl get pods -n staging -l app.kubernetes.io/service-name=exam-service -w
```

Output sẽ thấy 2 pods mới chuyển từ `Pending → ContainerCreating → Running`.

### 3.2 Scale về 1

```powershell
kubectl scale deployment luyen-thi-lai-xe-exam-service --replicas=1 -n staging
```

> [!IMPORTANT]
> Nếu HPA đang bật, nó sẽ override giá trị manual về `minReplicas` sau vài phút. Đây là hành vi đúng.

---

## 4. Demo HPA Auto Scale (Stress Test)

### 4.1 Mở 2 terminal song song

**Terminal 1 — Quan sát HPA:**
```powershell
# Refresh mỗi 5 giây
while ($true) {
  Clear-Host
  Write-Host "=== $(Get-Date -Format 'HH:mm:ss') ===" -ForegroundColor Cyan
  kubectl get hpa -n staging
  Write-Host ""
  kubectl get pods -n staging -l app.kubernetes.io/service-name=exam-service
  Start-Sleep 5
}
```

**Terminal 2 — Gây tải:**
```powershell
$API = "http://api.52.139.233.166.nip.io"

# Lấy access token (dùng student account)
$tokenResponse = Invoke-RestMethod -Method POST `
  -Uri "$API/auth/realms/luyen-thi-lai-xe-realm/protocol/openid-connect/token" `
  -ContentType "application/x-www-form-urlencoded" `
  -Body "client_id=nestjs-backend&grant_type=password&username=student1@test.com&password=Password123!"
$token = $tokenResponse.access_token

Write-Host "Token obtained. Starting load test..." -ForegroundColor Green

# Gây tải liên tục (chạy 5 phút)
$deadline = (Get-Date).AddMinutes(5)
$count = 0
while ((Get-Date) -lt $deadline) {
  try {
    Invoke-RestMethod -Uri "$API/exams" `
      -Headers @{ Authorization = "Bearer $token" } `
      -ErrorAction SilentlyContinue | Out-Null
  } catch {}
  $count++
  if ($count % 100 -eq 0) {
    Write-Host "[$((Get-Date).ToString('HH:mm:ss'))] Sent $count requests..." -ForegroundColor Yellow
  }
}
Write-Host "Load test complete. Total requests: $count" -ForegroundColor Green
```

### 4.2 Quan sát scale up

Sau 1–2 phút, terminal 1 sẽ thấy:
1. CPU% của `exam-service` tăng vượt 70%
2. HPA tăng REPLICAS từ 1 → 2, rồi 2 → 3 (scale up behavior: +2 pods/60s)
3. Pods mới xuất hiện ở trạng thái `Pending → Running`

### 4.3 Dừng tải và quan sát scale down

Sau khi dừng vòng lặp ở Terminal 2:
- HPA chờ **300 giây** (stabilization window) trước khi scale down
- Scale down từ từ: -1 pod mỗi 120 giây

Đây là thiết kế có chủ ý để tránh **thrashing** (scale up/down liên tục).

---

## 5. Demo Pod Failure & Self-Healing

Kubernetes tự động restart pods khi chúng crash:

### 5.1 Kill một pod thủ công

```powershell
# Lấy danh sách pods
kubectl get pods -n staging -l app.kubernetes.io/service-name=exam-service

# Kill pod (copy tên pod từ lệnh trên)
$podName = "luyen-thi-lai-xe-exam-service-xxxxxxxxx-xxxxx"
kubectl delete pod $podName -n staging

# Quan sát pod mới được tạo tự động
kubectl get pods -n staging -l app.kubernetes.io/service-name=exam-service -w
```

Pod mới sẽ được tạo trong vài giây. Trong lúc đó, nếu có nhiều hơn 1 replica, traffic vẫn được serve bởi pod còn lại.

### 5.2 Giải thích Liveness/Readiness Probes

```powershell
kubectl describe pod $podName -n staging | Select-String -Pattern "Liveness|Readiness|Restart Count" -A2
```

- **Liveness Probe** (`/health/live`): nếu fail 3 lần → pod bị restart
- **Readiness Probe** (`/health/ready`): nếu fail → pod bị remove khỏi load balancer, không nhận traffic mới
- **Restart Count**: số lần pod đã restart (> 0 là có vấn đề)

---

## 6. Demo Rolling Update (Zero-Downtime)

### 6.1 Xem cấu hình rolling update

```powershell
kubectl get deployment luyen-thi-lai-xe-exam-service -n staging -o jsonpath='{.spec.strategy}'
```

Config: `maxSurge: 25%, maxUnavailable: 25%` — luôn có 75% pods sẵn sàng trong khi deploy.

### 6.2 Trigger rolling restart

```powershell
# Simulate deploy mới (restart tất cả pods từng cái một)
kubectl rollout restart deployment luyen-thi-lai-xe-exam-service -n staging

# Quan sát quá trình rolling update
kubectl rollout status deployment luyen-thi-lai-xe-exam-service -n staging -w
```

### 6.3 Rollback nếu có vấn đề

```powershell
# Xem lịch sử deployment
kubectl rollout history deployment luyen-thi-lai-xe-exam-service -n staging

# Rollback về revision trước
kubectl rollout undo deployment luyen-thi-lai-xe-exam-service -n staging

# Verify đã rollback
kubectl rollout status deployment luyen-thi-lai-xe-exam-service -n staging
```

---

## 7. Xem Resource Utilization tổng quan

```powershell
# Top pods theo CPU
kubectl top pods -n staging --sort-by=cpu

# Top pods theo Memory
kubectl top pods -n staging --sort-by=memory

# Top nodes
kubectl top nodes

# Xem tất cả deployments và replicas hiện tại
kubectl get deployments -n staging -l app.kubernetes.io/component=app
```

---

## 8. HPA Configuration Summary

| Service | min | max | CPU target | Ghi chú |
|---------|-----|-----|-----------|---------|
| identity-service | **2** | 5 | 70% | min=2 vì xử lý auth, critical |
| exam-service | 1 | 4 | 70% | Heavy load khi thi |
| course-service | 1 | 3 | 70% | |
| analytics-service | 1 | 3 | 70% | CPU-intensive |
| simulation-service | 1 | 3 | 70% | CPU-intensive |
| user-service | 1 | 3 | 70% | |
| question-service | 1 | 3 | 70% | |
| notification-service | 1 | 3 | 70% | |
| audit-service | 1 | **2** | 70% | Chỉ cần max=2, ít traffic |
| media-service | — | — | — | Không HPA, I/O-bound |

**Scale up**: +2 pods/60s · stabilization 60s  
**Scale down**: -1 pod/120s · stabilization **300s** (5 phút chống thrashing)

---

## 9. Troubleshooting

### HPA hiển thị `<unknown>` ở TARGETS

```powershell
kubectl describe hpa luyen-thi-lai-xe-exam-service -n staging
# Tìm dòng: "unable to fetch metrics from resource metrics API"

# Kiểm tra metrics-server
kubectl get apiservice v1beta1.metrics.k8s.io
kubectl get deployment metrics-server -n kube-system
```

**Nguyên nhân phổ biến:**
- metrics-server chưa chạy
- Pod thiếu `resources.requests` (không tính được utilization %)
- HPA mới tạo, cần 1–2 phút để collect metrics

### HPA không scale dù CPU cao

```powershell
# Kiểm tra node capacity
kubectl describe nodes | Select-String "Allocated resources" -A10

# Xem events
kubectl get events -n staging --sort-by='.lastTimestamp' | Select-Object -Last 20
```

Nếu node không đủ CPU/Memory → AKS Cluster Autoscaler cần được bật để thêm node mới.

### Pod bị CrashLoopBackOff

```powershell
# Xem logs của pod bị crash
kubectl logs <pod-name> -n staging --previous

# Xem events
kubectl describe pod <pod-name> -n staging | Select-String "Events" -A20
```
