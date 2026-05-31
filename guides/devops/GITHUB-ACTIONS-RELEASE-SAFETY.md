# Release Safety Cho GitHub Actions

Phần release safety này chỉ tập trung vào GitHub Actions, không thay đổi Jenkins. Mục tiêu là làm release an toàn hơn sau khi đã có CI/CD, GHCR, Helm deploy, DORA và business metrics.

## 1. Thành phần đã thêm

- `.github/workflows/ci.yml`:
  - Sinh SBOM dạng SPDX JSON cho từng service image.
  - Upload SBOM thành GitHub Actions artifact.
  - Ký immutable image tag bằng Cosign keyless signing sau khi push lên GHCR.
  - Gắn SBOM attestation vào immutable image tag.
  - Verify lại chữ ký image ngay trong workflow.
- `.github/workflows/rollback-release.yml`:
  - Workflow thủ công để rollback Helm release theo revision.
  - Hỗ trợ `staging` và `production`.
  - Chạy smoke test sau rollback nếu bật `run_smoke`.
  - Ghi deployment event loại `helm-rollback` để DORA report tính được rollback/change failure.
- `.github/workflows/dora-report.yml`:
  - Đọc thêm deployment event từ workflow `Rollback Release`.

## 2. SBOM là gì và dùng để demo thế nào?

SBOM là danh sách dependency/package có trong image. Khi image được build trên GitHub Actions, workflow tạo file:

```text
sbom-<service>.spdx.json
sbom-migration-runner.spdx.json
```

Các file này được upload vào artifact của workflow `Main Image Release`.

Lời thoại gợi ý:

> Sau khi build và scan Trivy, pipeline còn sinh SBOM cho từng image. SBOM giúp nhóm biết image đang chứa những package nào, phục vụ audit bảo mật và xử lý CVE về sau.

## 3. Cosign signing là gì và dùng để demo thế nào?

Sau khi image được push lên GHCR bằng tag `${github.sha}`, workflow dùng Cosign keyless signing để ký image. Chữ ký gắn với GitHub OIDC identity của workflow:

```text
https://github.com/<owner>/<repo>/.github/workflows/ci.yml@refs/heads/main
```

Workflow cũng verify lại chữ ký bằng Cosign.

Lời thoại gợi ý:

> Image không chỉ được build và scan, mà còn được ký bằng Cosign. Khi deploy, team có thể truy vết image này đến workflow GitHub Actions đã tạo ra nó. Đây là nền tảng cho provenance và policy admission nếu harden production sâu hơn.

## 4. Cách rollback bằng GitHub Actions

Mở tab Actions:

```text
Actions -> Rollback Release -> Run workflow
```

Chọn input:

| Input | Ý nghĩa |
| --- | --- |
| `target_environment` | `staging` hoặc `production`. |
| `helm_revision` | Revision muốn rollback về. Xem bằng `helm history luyen-thi-lai-xe -n <namespace>`. |
| `confirm_rollback` | Phải bật `true` để tránh rollback nhầm. |
| `run_smoke` | Nên để `true` để smoke test sau rollback. |
| `rollback_reason` | Lý do rollback để lưu vào deployment event. |

Workflow sẽ:

1. Kết nối Kubernetes cluster.
2. In `helm history`.
3. Chạy `helm rollback`.
4. Chờ rollout.
5. Chạy smoke test nếu được bật.
6. Ghi deployment event và upload artifact.

## 5. Khi demo với giảng viên

Nên mở 3 nơi:

1. Workflow `Main Image Release`: chỉ vào các step `Generate SBOM`, `Sign immutable image and attach SBOM attestation`, `Verify image signature`.
2. Artifact của workflow: chỉ các file `sbom-*.spdx.json`.
3. Workflow `Rollback Release`: chỉ input `helm_revision`, `confirm_rollback`, `run_smoke`.

Lời thoại gợi ý:

> Release safety bổ sung vào GitHub Actions. Mỗi image sau khi build sẽ có SBOM, được ký bằng Cosign và verify chữ ký. Nếu deploy lỗi, nhóm có workflow rollback Helm revision có kiểm soát, chạy smoke test sau rollback và ghi deployment event để DORA report phản ánh đúng.

## 6. Lưu ý vận hành

- Chỉ ký immutable tag `${github.sha}`. Không nên coi `latest` là artifact production vì `latest` có thể thay đổi.
- Rollback Helm không rollback database migration. Migration production vẫn cần viết theo hướng backward-compatible hoặc tạo migration sửa tiếp.
- Production rollback vẫn đi qua GitHub Environment `production`, nên cần bật required reviewers trong GitHub settings nếu muốn có approval thật.
- Nếu sau này dùng admission policy trên Kubernetes, có thể yêu cầu image phải có Cosign signature trước khi pod được chạy.
