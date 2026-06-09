# Deployment Event Store

Deployment event store bổ sung **deployment event store** để dữ liệu deploy bền hơn và không phụ thuộc hoàn toàn vào GitHub Actions history.

Trước khi có deployment event store, DORA report đọc trực tiếp GitHub Actions workflow runs. Cách đó đủ cho MVP, nhưng có hạn chế:

- GitHub Actions history có thể bị giới hạn hoặc khó truy xuất lâu dài.
- Jenkins hoặc deploy thủ công không tự xuất hiện trong cùng một nguồn dữ liệu.
- Khi cần audit deploy, nên có record rõ ràng: deploy lúc nào, image tag nào, môi trường nào, kết quả ra sao.

Deployment event store giải quyết bằng cách ghi mỗi lần deploy thành một JSON event.

## 1. File và workflow liên quan

- `scripts/devops-record-deployment.js`: ghi deployment event JSON.
- `scripts/devops-dora-report.ts`: đọc deployment event store trước, fallback sang GitHub Actions history.
- `Jenkinsfile`: ghi event cho Jenkins Docker Compose deploy.
- `.github/workflows/ci.yml`: ghi event cho deploy staging GCP/K3s.
- `.github/workflows/production-release.yml`: ghi event cho production Helm release.
- `.github/workflows/deploy-compose-legacy.yml`: ghi event cho legacy Docker Compose deploy.
- `.github/workflows/dora-report.yml`: tải artifact `deployment-event-*` trước khi tạo DORA report.

## 2. Schema deployment event

Mỗi event là một file JSON có dạng:

```json
{
  "schemaVersion": 1,
  "eventId": "26710090105-1-staging-1780231406614",
  "source": "github-actions",
  "provider": "github-actions",
  "repository": "owner/repo",
  "workflow": "Main Image Release",
  "workflowRunId": "26710090105",
  "workflowRunAttempt": "1",
  "job": "deploy-staging",
  "environment": "staging",
  "deploymentType": "helm",
  "deploymentTarget": "gcp-k3s",
  "releaseName": "luyen-thi-lai-xe",
  "namespace": "staging",
  "gitSha": "df2af3a8eb40...",
  "imageTag": "df2af3a8eb40...",
  "branch": "main",
  "status": "success",
  "startedAt": "2026-05-31T10:30:00Z",
  "finishedAt": "2026-05-31T10:57:00Z",
  "deployUrl": "https://github.com/owner/repo/actions/runs/26710090105",
  "actor": "username",
  "trigger": "push",
  "rollbackOf": "",
  "smokeStatus": "success",
  "metadata": {}
}
```

Các trường quan trọng nhất cho DORA:

| Trường | Dùng để làm gì |
| --- | --- |
| `environment` | Phân biệt staging/production/local |
| `gitSha` | Tính Lead Time for Changes từ commit timestamp |
| `imageTag` | Audit artifact đã deploy |
| `status` | Tính deploy success/failure |
| `startedAt`, `finishedAt` | Tính thời lượng deploy và timeline |
| `deployUrl` | Link về workflow/Jenkins build |
| `rollbackOf` | Ghi nhận rollback nếu có |

## 3. Cách ghi deployment event

Chạy local:

```powershell
$env:DEPLOYMENT_ENVIRONMENT = "staging"
$env:DEPLOYMENT_TYPE = "helm"
$env:DEPLOYMENT_IMAGE_TAG = "local-test"
$env:DEPLOYMENT_GIT_SHA = "local-test"
$env:DEPLOYMENT_STATUS = "success"
npm run deployment:record
```

File event sẽ được ghi vào:

```text
reports/deployments/events/
```

Thư mục `reports/deployments/` được ignore vì đây là artifact runtime.

## 4. Cách workflow deploy ghi event

Mỗi workflow deploy có 2 bước ở cuối job:

```yaml
- name: Record deployment event
  if: always()
  run: npm run deployment:record

- name: Upload deployment event
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: deployment-event-...
    path: reports/deployments/events/
```

`if: always()` rất quan trọng. Nếu deploy fail, workflow vẫn ghi event với `status=failure`, nhờ vậy DORA report tính được Change Failure Rate.

## 5. Cách DORA report dùng event store

Workflow `DORA Metrics Report` tải artifact deployment event từ các workflow deploy gần đây:

- `Main Image Release`
- `Production Release`
- `Legacy SSH Compose Deploy`

Sau đó script DORA đọc:

```text
reports/deployments/
```

Thứ tự ưu tiên:

1. Deployment event JSON.
2. GitHub Actions workflow history nếu chưa có event.

Nếu local bị GitHub API rate limit, DORA report vẫn có thể chạy nếu thư mục `reports/deployments/` đã có event JSON.

## 6. Demo với giảng viên

Lời thoại gợi ý:

> Nhóm không chỉ đọc lịch sử workflow tạm thời mà ghi mỗi lần deploy thành một deployment event. Event này lưu môi trường, image tag, Git SHA, trạng thái, thời gian bắt đầu/kết thúc và link workflow. DORA report ưu tiên đọc event store, nên sau này có thể gom dữ liệu từ GitHub Actions, Jenkins hoặc manual deploy vào cùng một schema.

Demo nhanh:

```powershell
$env:DEPLOYMENT_ENVIRONMENT = "staging"
$env:DEPLOYMENT_TYPE = "helm"
$env:DEPLOYMENT_IMAGE_TAG = "demo-tag"
$env:DEPLOYMENT_GIT_SHA = "demo-tag"
$env:DEPLOYMENT_STATUS = "success"
npm run deployment:record
npm run dora:report
```

Sau đó mở:

```text
reports/dora/dora-report.md
```

## 7. Việc nên làm tiếp

- Ghi deployment event vào Cloud Storage hoặc database thay vì chỉ upload GitHub artifact.
- Thêm Jenkins API integration để tự tải event artifacts từ Jenkins build history.
- Workflow `Rollback Release` đã ghi `rollbackOf`; việc tiếp theo là chạy thử rollback trên staging thật và lưu artifact làm bằng chứng.
- Đẩy deployment event thành Prometheus metrics hoặc Grafana datasource.
