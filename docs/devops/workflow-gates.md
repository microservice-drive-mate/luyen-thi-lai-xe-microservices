# Workflow Gates Và Branch Protection

CI backend được tách thành nhiều job nhỏ, mỗi job tập trung vào một trách nhiệm. Tuy vậy, branch protection không nên require từng matrix job riêng lẻ; thay vào đó nên require các gate tổng hợp có tên ổn định.

## Required Checks

| Nhánh hoặc luồng        | Required status check        |
| ----------------------- | ---------------------------- |
| Pull request vào `main` | `PR Validation Gate`         |
| Main image release      | `Main Release Gate`          |
| Consumer contract PR    | `Pact Contract Verification` |

Không nên require trực tiếp các matrix job như `Build and Scan Services (identity-service)`. Service matrix thay đổi theo diff của PR, nên các check này có thể xuất hiện, biến mất hoặc bị skip. Aggregate gate đọc kết quả của các job bên trong và fail nếu có job bắt buộc nào fail hoặc bị cancel.

## Reusable Workflows

`reusable-quality-gate.yml` là workflow dùng chung cho quality gate backend:

- Generate Prisma client.
- Kiểm tra format/lint bằng Biome.
- Kiểm tra TypeScript.
- Chạy unit tests.

Cả `pr-validation.yml` và `ci.yml` đều gọi workflow này, nên khi cần đổi quality gate chỉ phải sửa ở một nơi.

## Concurrency

- `Pull Request Validation` cancel run cũ của cùng PR khi có commit mới được push.
- `Main Image Release` serialize release trên cùng ref và không cancel release đang chạy.
- `Contract Tests` cancel verification cũ của cùng consumer commit để tránh status Pact cũ ghi đè status mới.
