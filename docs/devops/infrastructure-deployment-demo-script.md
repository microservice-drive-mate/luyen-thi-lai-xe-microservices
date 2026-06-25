# Kịch bản Demo: Hạ tầng và Triển khai (Infrastructure & Deployment)

Tài liệu này cung cấp hướng dẫn từng bước chi tiết (Demo Script) cho **Chương 8: HẠ TẦNG VÀ TRIỂN KHAI** của đồ án DriveMate. Kịch bản này được thiết kế để bạn trình bày trước Hội đồng một cách mạch lạc, kết hợp giữa việc mở mã nguồn trong VS Code, thao tác trên terminal (local/cloud) và giao diện trực quan (GitHub, Consul, Portals).

---

## Bảng mục lục
1. [Môi trường phát triển Local với Docker Compose](#1-môi-trường-phát-triển-local-với-docker-compose)
2. [Đóng gói Docker Image và GitHub Container Registry (GHCR)](#2-đóng-gói-docker-image-và-github-container-registry-ghcr)
3. [Cấu hình và Điều phối với Kubernetes & Helm Chart](#3-cấu-hình-và-điều-phối-với-kubernetes-helm-chart)
4. [Quản lý Hạ tầng bằng Mã (IaC) với Terraform & Azure AKS](#4-quản-lý-hạ-tầng-bằng-mã-iac-với-terraform-azure-aks)
5. [Tự động hóa CI/CD với GitHub Actions](#5-tự-động-hóa-cicd-với-github-actions)
6. [Đo lường Chỉ số DORA Metrics](#6-đo-lường-chỉ-số-dora-metrics)
7. [Checklist chuẩn bị & Troubleshooting nhanh](#7-checklist-chuẩn-bị--troubleshooting-nhanh)

---

## 1. Môi trường phát triển Local với Docker Compose

### Mục tiêu demo
Chứng minh hệ thống đã chuẩn hóa môi trường phát triển cục bộ (dev environment) cho lập trình viên. Chỉ với 1 lệnh, toàn bộ cơ sở dữ liệu độc lập (mỗi microservice một DB riêng), message broker, cache và auth provider đều được dựng sẵn để lập trình viên sẵn sàng code mà không bị lỗi cấu hình.

### Các file cần show trong VS Code
* [docker-compose.infra.yml](file:///c:/Users/Ngo%20Minh%20Tri/workspace/uit/microservices/luyen-thi-lai-xe-microservices/docker-compose.infra.yml) (Hạ tầng lưu trữ, message broker, cache).
* [docker-compose.yaml](file:///c:/Users/Ngo%20Minh%20Tri/workspace/uit/microservices/luyen-thi-lai-xe-microservices/docker-compose.yaml) (Bản chạy toàn bộ service và database dưới dạng container).
* [Dockerfile.service](file:///c:/Users/Ngo%20Minh%20Tri/workspace/uit/microservices/luyen-thi-lai-xe-microservices/Dockerfile.service) (Dockerfile dùng chung cho các NestJS service thông qua build argument `SERVICE_NAME`).
* [Dockerfile.migration-runner](file:///c:/Users/Ngo%20Minh%20Tri/workspace/uit/microservices/luyen-thi-lai-xe-microservices/Dockerfile.migration-runner) (Đóng gói riêng tác vụ chạy migration database).

### Thao tác trực quan & Command
1. Mở PowerShell local, kiểm tra trạng thái hạ tầng đang chạy:
   ```powershell
   docker compose -f docker-compose.infra.yml ps
   ```
   *Kỳ vọng:* Bạn sẽ thấy danh sách các container hạ tầng (`db-identity`, `db-user`, `redis`, `rabbitmq`, `keycloak`, `consul`, `kong`) đều ở trạng thái `running` (Up) và khỏe mạnh (healthy).

2. Show thiết kế Dockerfile dùng chung:
   - Mở [Dockerfile.service](file:///c:/Users/Ngo%20Minh%20Tri/workspace/uit/microservices/luyen-thi-lai-xe-microservices/Dockerfile.service) trong VS Code.
   - Nhấn mạnh dòng `ARG SERVICE_NAME` ở đầu file và cách code COPY source từ workspace để build image cho bất kỳ service nào (identity, course, exam, question, v.v.).

### Lời thoại gợi ý
> "Để giải quyết bài toán phức tạp khi phát triển microservices tại máy local, nhóm đã cấu hình hệ thống Docker Compose chia làm hai lớp: Lớp hạ tầng (`docker-compose.infra.yml`) và lớp dịch vụ nghiệp vụ. Lập trình viên chỉ cần chạy một câu lệnh là có ngay 9 database độc lập cho từng service, hệ thống cache Redis, hàng đợi RabbitMQ, identity Keycloak và API Gateway Kong. Dockerfile của chúng em cũng được tối ưu hóa: viết duy nhất một `Dockerfile.service` sử dụng Build Argument `SERVICE_NAME` để build ra các image chuyên biệt cho từng service, giúp tối ưu cache Docker và dễ bảo trì."

---

## 2. Đóng gói Docker Image và GitHub Container Registry (GHCR)

### Mục tiêu demo
Chứng minh hệ thống đóng gói các Docker image bất biến (immutable) và lưu trữ chúng an toàn trên GitHub Container Registry (GHCR), sử dụng tag tương ứng với Git SHA để phục vụ kiểm soát phiên bản và rollback chính xác.

### Giao diện và thông tin cần show
1. Mở trình duyệt web truy cập trang GitHub Packages của dự án (hoặc trang GitHub cá nhân/tổ chức chứa Package).
2. Show danh sách các image đã được đóng gói:
   - `luyen-thi-lai-xe-identity-service`
   - `luyen-thi-lai-xe-course-service`
   - `luyen-thi-lai-xe-exam-service`
   - `luyen-thi-lai-xe-migration-runner`
3. Nhấp vào một package, chỉ ra các Tag dạng `sha-xxxxxxx` (ví dụ `sha-3fec9f2`). Tránh dùng tag `latest` để tránh tình trạng trôi phiên bản (drift) trên môi trường production.

### Lời thoại gợi ý
> "Sau khi kiểm thử cục bộ thành công, các Docker image sẽ được đóng gói tự động qua CI/CD và đẩy lên GitHub Container Registry (GHCR). Toàn bộ image release đều được gắn nhãn (tag) khớp với Git SHA tại thời điểm build (ví dụ `sha-3fec9f2`). Việc sử dụng tag dạng Git SHA thay vì `latest` giúp đảm bảo tính bất biến của bản phát hành, giúp chúng em biết chính xác dòng code nào đang chạy trên môi trường thực tế và dễ dàng rollback về bất kỳ phiên bản nào trước đó một cách an toàn."

---

## 3. Cấu hình và Điều phối với Kubernetes & Helm Chart

### Mục tiêu demo
Chứng minh khả năng quản lý hàng chục tài nguyên Kubernetes một cách tối ưu. Thay vì viết thủ công hàng trăm file YAML trùng lặp, nhóm sử dụng Helm Chart để đóng gói toàn bộ hệ thống, cho phép định cấu hình linh hoạt theo từng môi trường thông qua tệp cấu hình `values.yaml`.

### Các file cần show trong VS Code
* [charts/luyen-thi-lai-xe/templates/apps.yaml](file:///c:/Users/Ngo%20Minh%20Tri/workspace/uit/microservices/luyen-thi-lai-xe-microservices/charts/luyen-thi-lai-xe/templates/apps.yaml) (Cách dùng vòng lặp `range .Values.services` để render động Deployments và Services).
* [charts/luyen-thi-lai-xe/templates/jobs.yaml](file:///c:/Users/Ngo%20Minh%20Tri/workspace/uit/microservices/luyen-thi-lai-xe-microservices/charts/luyen-thi-lai-xe/templates/jobs.yaml) (Kubernetes Jobs chạy migration database và seed cấu hình Consul).
* [charts/luyen-thi-lai-xe/values-staging.example.yaml](file:///c:/Users/Ngo%20Minh%20Tri/workspace/uit/microservices/luyen-thi-lai-xe-microservices/charts/luyen-thi-lai-xe/values-staging.example.yaml) (Tham số cho môi trường Staging).

### Thao tác trực quan & Command
1. Mở PowerShell, chạy thử lệnh render mẫu Helm template tại local (Dry-run):
   ```powershell
   helm template luyen-thi-lai-xe charts/luyen-thi-lai-xe --set imagePullSecret.enabled=false
   ```
   *Kỳ vọng:* Terminal sẽ xuất ra nội dung cấu hình YAML hoàn chỉnh (Deployments, Services, ConfigMaps, Jobs) đã được Helm render tự động từ các tham số trong `values.yaml`.

2. Giải thích cơ chế kiểm soát thứ tự khởi động (Startup Order) trong [charts/luyen-thi-lai-xe/templates/apps.yaml](file:///c:/Users/Ngo%20Minh%20Tri/workspace/uit/microservices/luyen-thi-lai-xe-microservices/charts/luyen-thi-lai-xe/templates/apps.yaml):
   - Mở file và tìm phần `initContainers`.
   - Show đoạn code cấu hình initContainer chờ `consul-seed` hoàn tất và các service database/migration sẵn sàng trước khi application pod khởi động.

### Lời thoại gợi ý
> "Khi triển khai lên Kubernetes, việc quản lý hàng chục file YAML cho các microservices rất dễ nhầm lẫn. Nhóm đã đóng gói toàn bộ hạ tầng phần mềm dưới dạng một Helm Chart duy nhất. Đặc biệt, trong file `apps.yaml`, chúng em viết một vòng lặp động chạy qua danh sách services được định nghĩa trong file `values.yaml`. Việc thêm một service mới giờ đây chỉ mất 5 dòng cấu hình thay vì phải viết mới cả trăm dòng YAML. Chúng em cũng cấu hình thêm `initContainers` cho các pod nghiệp vụ để kiểm tra kết nối database và đợi quá trình chạy migration hoàn tất, đảm bảo hệ thống không bị lỗi crash-loop khi khởi động đồng loạt trên cluster."

---

## 4. Quản lý Hạ tầng bằng Mã (IaC) với Terraform & Azure AKS

### Mục tiêu demo
Chứng minh toàn bộ tài nguyên cloud trên Microsoft Azure (Kubernetes Cluster, Storage Account, Node Pools, Monitoring) được quản lý tự động bằng mã nguồn Terraform, giúp hạ tầng có thể tái cấu trúc chỉ trong vài phút mà không cần thao tác thủ công bằng tay trên giao diện Azure Portal.

### Các file cần show trong VS Code
* [terraform/azure-aks/main.tf](file:///c:/Users/Ngo%20Minh%20Tri/workspace/uit/microservices/luyen-thi-lai-xe-microservices/terraform/azure-aks/main.tf) (File khai báo module chính).
* [terraform/modules/azure-aks/main.tf](file:///c:/Users/Ngo%20Minh%20Tri/workspace/uit/microservices/luyen-thi-lai-xe-microservices/terraform/modules/azure-aks/main.tf) (Module khai báo chi tiết AKS, Resource Group, Storage, Node Pools).
* [terraform/azure-aks/terraform.tfvars.example](file:///c:/Users/Ngo%20Minh%20Tri/workspace/uit/microservices/luyen-thi-lai-xe-microservices/terraform/azure-aks/terraform.tfvars.example) (Cấu hình tham số môi trường).

### Thao tác trực quan & Command
1. Mở PowerShell, chứng minh cách kiểm tra kế hoạch thay đổi hạ tầng của Terraform trước khi áp dụng thực tế (Dry-run):
   - Di chuyển terminal đến thư mục cấu hình:
     ```powershell
     # LƯU Ý: Lập trình viên chạy lệnh này ở thư mục local
     # cd terraform/azure-aks
     # terraform init
     # terraform plan -var-file=terraform.tfvars.example
     ```
   *Kỳ vọng:* Output hiển thị kế hoạch tài nguyên sẽ được tạo ra (ví dụ: `Plan: 7 to add, 0 to change, 0 to destroy`).

2. Giải thích cấu hình Node Pools động và Azure Storage:
   - Chỉ ra đoạn code cấu hình Storage Account riêng cho `media-service` ở chế độ Private với các cấu hình CORS cụ thể cho phép Frontend giao tiếp an toàn qua pre-signed URL.

### Lời thoại gợi ý
> "DriveMate áp dụng triết lý Infrastructure as Code (IaC) thông qua Terraform để quản lý tài nguyên trên Azure. Toàn bộ hạ tầng bao gồm Kubernetes cluster, Node Pools, hệ thống log Azure Monitor, và Azure Storage Account cho dịch vụ tải file media đều được mô tả bằng code. Môi trường Staging và Production được phân tách rõ ràng qua các tệp biến `.tfvars` riêng biệt. Nhờ Terraform, nhóm có thể tự động nâng cấp kích thước Node Pool hoặc dựng mới hoàn toàn một Kubernetes cluster chuẩn chỉ trong vòng chưa đầy 10 phút mà không có bất kỳ sai lệch cấu hình thủ công nào."

---

## 5. Tự động hóa CI/CD với GitHub Actions

### Mục tiêu demo
Chứng minh toàn bộ quy trình tích hợp liên tục (CI) và triển khai liên tục (CD) được tự động hóa nghiêm ngặt thông qua GitHub Actions, tích hợp đầy đủ kiểm soát bảo mật, chất lượng mã nguồn và cơ chế rollback tức thì.

### Các workflow cần show trên GitHub Actions UI
* **PR Validation (`pr-validation.yml`)**: Chạy test, audit mã nguồn tự động khi có Pull Request.
* **Main Image Release (`ci.yml`)**: Tự động kích hoạt khi merge vào nhánh `main`. Build Docker, scan lỗ hổng bằng Trivy, ký số bảo mật bằng Cosign và push lên GHCR.
* **Deploy Azure AKS Staging (`deploy-azure-staging.yml`)**: Triển khai tự động (Continuous Deployment) lên AKS staging, chạy smoke test và ghi deployment event.
* **Production Release (`production-release.yml`)**: Triển khai thủ công lên Production, được bảo vệ bằng cơ chế Approval Gate từ lập trình viên chính (Maintainer).
* **Rollback Release (`rollback-release.yml`)**: Workflow thu hồi phiên bản lỗi về phiên bản Helm hoạt động ổn định gần nhất.

### Giao diện thực tế để show
1. Truy cập tab **Actions** trên Repository GitHub của dự án.
2. Mở một run thành công gần nhất của **Main Image Release** hoặc **Deploy Azure AKS Staging**:
   - Chỉ ra các bước chạy thành công.
   - Show phần **Artifacts** ở cuối trang run để chứng minh hệ thống đã sinh ra SBOM (Software Bill of Materials) phục vụ kiểm duyệt danh sách dependencies bên trong Docker image.
   - Chỉ ra step `Sign immutable image with Cosign` để chứng minh ảnh Docker được ký số chống giả mạo.

3. Mở workflow **Production Release** để chỉ ra nút Approve (nếu có run đang chờ), giải thích quy trình phê duyệt thủ công trước khi đẩy lên production.

### Lời thoại gợi ý
> "Hệ thống CI/CD của dự án được tự động hóa hoàn toàn bằng GitHub Actions với quy trình bảo mật 3 lớp. Khi có lập trình viên tạo Pull Request, workflow `PR Validation` sẽ kiểm tra cú pháp và chạy test tự động. Khi merge code vào nhánh chính, hệ thống sẽ thực hiện scan bảo mật Docker image bằng Trivy (nếu có lỗ hổng mức Critical sẽ lập tức dừng build), sinh file danh mục SBOM, và ký số chống giả mạo bằng Cosign trước khi đưa lên GHCR. Môi trường Staging sẽ tự động deploy mỗi khi code merge thành công, trong khi môi trường Production bắt buộc phải đi qua cổng phê duyệt thủ công (Environment Approval Gate) để đảm bảo an toàn tuyệt đối."

---

## 6. Đo lường Chỉ số DORA Metrics

### Mục tiêu demo
Chứng minh dự án được quản lý theo đúng chuẩn vận hành hiện đại, sử dụng dữ liệu thực tế từ pipeline triển khai để tính toán các chỉ số DORA nhằm tự động hóa đánh giá năng lực phát triển phần mềm của đội ngũ.

### File cần show trong VS Code
* [reports/dora/dora-report.md](file:///c:/Users/Ngo%20Minh%20Tri/workspace/uit/microservices/luyen-thi-lai-xe-microservices/reports/dora/dora-report.md) (Bản báo cáo chi tiết được sinh tự động từ pipeline).

### Thao tác trực quan & Command
1. Mở file [dora-report.md](file:///c:/Users/Ngo%20Minh%20Tri/workspace/uit/microservices/luyen-thi-lai-xe-microservices/reports/dora/dora-report.md) trong VS Code.
2. Trình bày các chỉ số cốt lõi:
   - **Deployment Frequency (Tần suất triển khai)**: Cho thấy đội ngũ đẩy code lên Staging/Production bao nhiêu lần một tuần (Ví dụ: `2.8 deploy/tuần` - Mức *High*).
   - **Lead Time for Changes (Thời gian hoàn thành thay đổi)**: Thời gian từ lúc commit code đến khi deploy thành công (Ví dụ: `31 phút` - Mức *Elite*).
   - **Change Failure Rate (Tỉ lệ triển khai thất bại)**: Tỉ lệ các lần deploy bị lỗi hoặc phải rollback (Ví dụ: `40%` - Mức *Medium*).
   - **MTTR (Mean Time to Restore)**: Thời gian trung bình để khôi phục dịch vụ khi xảy ra incident.

### Lời thoại gợi ý
> "Để đo lường hiệu quả vận hành và chất lượng kỹ thuật của dự án, chúng em đã tích hợp DORA Metrics ngay vào hệ thống CI/CD. Mỗi khi một lượt deploy thành công hay thất bại, hoặc khi có sự cố được ghi nhận qua GitHub Issues, hệ thống tự động ghi nhận dữ liệu sự kiện. Script phân tích tự động sẽ tổng hợp và xuất ra báo cáo `dora-report.md`. Hiện tại, dự án đạt chỉ số Lead Time for Changes ở mức Elite (dưới 1 tiếng) nhờ pipeline CI/CD mượt mà, và Deployment Frequency ở mức High. Đây là minh chứng rõ ràng cho khả năng vận hành chuyên nghiệp của dự án."

---

## 7. Checklist chuẩn bị & Troubleshooting nhanh

### Checklist chuẩn bị trước giờ Demo
* [ ] Kiểm tra Docker Desktop/Rancher Desktop local đã được khởi động.
* [ ] Đảm bảo hạ tầng local chạy ổn định: `docker compose -f docker-compose.infra.yml ps` hiển thị toàn bộ container màu xanh.
* [ ] Kiểm tra file `.env` local đã chứa đầy đủ cấu hình kết nối.
* [ ] Trình duyệt web đã đăng nhập sẵn vào GitHub dự án để sẵn sàng mở mục **Actions** và **Packages**.
* [ ] Mở sẵn Consul UI ở tab Key/Value tại địa chỉ `http://localhost:8500`.

### Hướng dẫn xử lý sự cố nhanh (Troubleshooting)
1. **Docker Compose local bị xung đột Port:**
   - Triệu chứng: Báo lỗi *port is already allocated* khi up infra.
   - Xử lý: Dùng lệnh `netstat -ano | findstr :<port>` (ví dụ `:5432` hoặc `:8080`) để tìm Process ID đang chiếm dụng port và kill nó bằng `taskkill /F /PID <PID>`, sau đó restart docker compose.

2. **Consul local không nhận cấu hình (Consul KV trống):**
   - Triệu chứng: Service không start được do báo lỗi cấu hình.
   - Xử lý: Chạy lại lệnh seed cấu hình local:
     ```powershell
     pnpm consul:seed:local
     ```

3. **Database local bị lệch Migration:**
   - Triệu chứng: Gọi API báo lỗi *Prisma Client needs to be migrated*.
   - Xử lý: Chạy lệnh đồng bộ database schema:
     ```powershell
     pnpm db:migrate
     ```
