# Quy trình Incident và Postmortem

Tài liệu này chuẩn hóa quy trình ghi nhận sự cố để báo cáo DORA tính được **MTTR** và **Change Failure Rate** đáng tin hơn.

Dự án đã có script tạo DORA report. Quy trình incident/postmortem bổ sung vận hành:

- Khi nào phải tạo incident.
- Cách phân loại severity.
- Label chuẩn để DORA script hiểu dữ liệu.
- Khi nào bắt buộc postmortem.
- Checklist xử lý và đóng incident.

## 1. Khi nào tạo incident

Tạo GitHub issue bằng template `Incident report` khi có một trong các trường hợp sau:

- Production hoặc staging không truy cập được qua Kong/Ingress.
- Health check, smoke test hoặc rollout fail sau deploy.
- Tỷ lệ lỗi 5xx tăng bất thường.
- Latency tăng cao làm ảnh hưởng trải nghiệm người dùng.
- RabbitMQ retry/DLQ backlog tăng và không tự hồi phục.
- Database, Keycloak, Consul, Redis hoặc RabbitMQ lỗi làm service chính không hoạt động.
- Người dùng hoặc giảng viên demo báo lỗi ảnh hưởng luồng chính.

Không cần tạo incident cho lỗi local cá nhân, lỗi format/lint trong PR hoặc pipeline fail trước khi deploy nếu không ảnh hưởng staging/production.

## 2. Severity chuẩn

| Severity | Khi dùng | Ví dụ |
| --- | --- | --- |
| `sev1` | Hệ thống ngừng phục vụ hoặc mất dữ liệu | Kong/GKE ingress down, user không thể đăng nhập toàn hệ thống |
| `sev2` | Chức năng chính lỗi, ảnh hưởng nhiều user | Không nộp được bài thi, exam-service lỗi 5xx diện rộng |
| `sev3` | Lỗi cục bộ hoặc có workaround | Một endpoint admin lỗi, retry queue tăng nhưng hệ thống vẫn phục vụ |
| `sev4` | Cảnh báo hoặc lỗi nhỏ | Alert warning, dashboard thiếu panel, log format chưa chuẩn |

Quy tắc:

- `sev1` và `sev2` bắt buộc có postmortem.
- `sev3` nên có postmortem nếu lặp lại nhiều lần hoặc liên quan deploy.
- `sev4` chỉ cần ghi chú trong incident nếu không có ảnh hưởng thật.

## 3. Label chuẩn

| Label | Ý nghĩa |
| --- | --- |
| `incident` | Issue là incident, được dùng để tính MTTR |
| `postmortem` | Issue là postmortem sau incident |
| `production` | Incident xảy ra ở production |
| `staging` | Incident xảy ra ở staging |
| `local` | Incident tái hiện ở local/dev |
| `sev1` | Sự cố nghiêm trọng nhất |
| `sev2` | Sự cố ảnh hưởng chức năng chính |
| `sev3` | Sự cố cục bộ/có workaround |
| `sev4` | Cảnh báo/lỗi nhỏ |
| `change-failure` | Deploy thành công nhưng gây lỗi runtime |
| `deploy-failure` | Deploy/smoke/health check fail |
| `rollback` | Cần rollback hoặc redeploy về tag cũ |
| `needs-postmortem` | Incident cần postmortem |

Workflow `.github/workflows/incident-labeler.yml` sẽ tự thêm phần lớn label dựa trên nội dung issue form. Nếu workflow không chạy, người tạo issue gắn label thủ công theo bảng trên.

## 4. Quy trình xử lý incident

1. Tạo issue bằng template `Incident report`.
2. Chọn đúng môi trường và severity.
3. Điền thời điểm phát hiện theo ISO 8601 nếu có thể.
4. Nếu liên quan deploy, điền Git SHA, image tag, workflow URL hoặc Jenkins build URL.
5. Nếu lỗi do deploy, tick các checkbox tương ứng:
   - Sự cố do deploy mới gây ra.
   - Cần rollback hoặc redeploy về tag cũ.
   - Smoke test hoặc health check fail sau deploy.
6. Xử lý theo runbook:
   - `guides/devops/INCIDENT-RUNBOOK.md`
   - `guides/devops/OBSERVABILITY-RUNBOOK.md`
7. Khi hệ thống đã khôi phục, cập nhật phần mitigation/evidence nếu cần.
8. Đóng issue incident ngay khi dịch vụ đã phục hồi.
9. Nếu là `sev1` hoặc `sev2`, tạo issue `Postmortem`.
10. Chạy lại DORA report:

```bash
npm run dora:report
```

## 5. Quy trình postmortem

Postmortem không dùng để đổ lỗi cá nhân. Mục tiêu là học từ incident và giảm khả năng lặp lại.

Postmortem cần có:

- Incident liên quan.
- Timeline bắt đầu - phát hiện - khôi phục.
- Nguyên nhân gốc.
- Điều đã làm tốt.
- Điều chưa tốt.
- Action items có owner và deadline.
- Ghi chú DORA: incident có tính vào MTTR/CFR không, có rollback không.

Checklist trước khi đóng postmortem:

- [ ] Root cause rõ ràng.
- [ ] Action items có owner.
- [ ] Action items có deadline.
- [ ] Nếu do deploy, incident đã có label `change-failure` hoặc `rollback`.
- [ ] Nếu do smoke/health fail, incident đã có label `deploy-failure`.
- [ ] Runbook hoặc smoke test được cập nhật nếu thiếu.

## 6. Cách DORA script dùng dữ liệu này

Script `scripts/devops-dora-report.ts` đọc GitHub issues có label `incident`.

- MTTR = `closed_at - created_at`.
- Môi trường được suy ra từ label `production`, `staging` hoặc `local`.
- Severity được suy ra từ label `sev1`, `sev2`, `sev3`, `sev4`.
- Change Failure Rate tăng khi issue có label `change-failure`, `deploy-failure` hoặc `rollback`.

Nếu incident chưa đóng, script vẫn liệt kê nhưng chưa tính vào MTTR trung bình.

## 7. Câu nói demo

> Quy trình incident/postmortem giúp biến incident thành dữ liệu đo lường. Khi có sự cố, nhóm tạo issue theo template, workflow tự gắn label môi trường/severity/change-failure. Khi issue đóng, DORA report tính được MTTR. Nếu incident liên quan deploy hoặc rollback, report cũng phản ánh vào Change Failure Rate.
