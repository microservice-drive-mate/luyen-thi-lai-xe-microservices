# Mục Lục Tài Liệu

Thư mục `docs/` là nguồn tài liệu chính của repo. Nếu cần đọc API của một service, ưu tiên các file trong `docs/api/`; không dùng lại các service summary ngắn vì nội dung API spec chi tiết và gần code hơn.

## Nên Đọc Trước

- [README root](../README.md): cách chạy repo, service, port, script và luồng local/dev.
- [Development Guidelines](./development-guidelines.md): quy tắc phát triển backend và checklist cập nhật docs khi code.
- [Kong + Frontend Integration](./api/kong-frontend-integration.md): base URL, route, auth, CORS và Swagger cho frontend.
- [DDD + Clean Architecture](./architecture/clean-ddd-conventions.md): convention kiến trúc và mẫu triển khai.
- [Services Test Guide](./testing/services-test-guide.md): hướng dẫn kiểm thử theo service.

## API Và Frontend

Nhóm này là nguồn chính cho API contract của service. Mỗi file nên mô tả endpoint, auth/role, request, response, error code, event side effect, Swagger URL và ghi chú frontend.

- [Tổng Hợp Backend & API Endpoints](./api/backend-summary.md)
- [Kong + Frontend Integration](./api/kong-frontend-integration.md)
- [Scalar API Reference Guide](./api/scalar-api-reference-guide.md)
- [Health & Metrics API](./api/api-spec-health-metrics.md)
- [Identity Service API](./api/api-spec-identity.md)
- [User Service API](./api/api-spec-user.md)
- [Exam Service API](./api/api-spec-exam.md)
- [Course Service API](./api/api-spec-course.md)
- [Question Service API](./api/api-spec-question.md)
- [Notification Service API](./api/api-spec-notification.md)
- [Analytics Service API](./api/api-spec-analytics.md)
- [Simulation Service API](./api/api-spec-simulation.md)
- [Media Service API](./api/api-spec-media.md)
- [Audit Service API](./api/api-spec-audit.md)
- [Identity And User Flow](./api/identity-user-flow.md)
- [Media Service Flow](./api/media-service-flow.md)

## Kiến Trúc Và Phát Triển

- [Development Guidelines](./development-guidelines.md)
- [Refactor Changes](./refactor-changes.md)
- [DDD + Clean Architecture Conventions](./architecture/clean-ddd-conventions.md)

## DevOps, Deploy Và Observability

- [DevOps Status Report](./devops/devops-status-report.md)
- [Consul Workflow](./devops/consul-workflow.md)
- [Azure AKS Deployment](./devops/azure-aks-deployment.md)
- [Azure GitHub Actions Setup](./devops/azure-github-actions-setup.md)
- [Azure Demo Runbook](./devops/azure-demo-runbook.md)
- [GitHub Actions Release Safety](./devops/github-actions-release-safety.md)
- [Backup Strategy](./devops/backup-strategy.md)
- [Deployment Event Store](./devops/deployment-event-store.md)
- [DORA Metrics Guide](./devops/dora-metrics-guide.md)
- [Business Metrics](./devops/business-metrics.md)
- [ELK Logging Guide](./devops/elk-logging-guide.md)
- [Observability Runbook](./devops/observability-runbook.md)
- [OpenTelemetry Jaeger Tracing](./devops/opentelemetry-jaeger-tracing.md)
- [Incident Management Process](./devops/incident-management-process.md)
- [System Resilience Guide](./devops/system-resilience-guide.md)
- [DevOps Demo Script](./devops/devops-demo-script.md)

## Yêu Cầu Và Truy Vết

- [SRS Document](./requirements/srs-document.md)
- [SRS ASR Mapping Summary](./requirements/srs-asr-mapping-summary.md)
- [Use Case Implementation Summary](./requirements/use-case-implementation-summary.md)
- [Forgot Password Email Summary](./requirements/forgot-password-email-summary.md)

## Kiểm Thử Và Demo

- [Services Test Guide](./testing/services-test-guide.md)
- [Contract Testing](./testing/contract-testing.md)
- [ASR Testing Guide](./testing/asr-testing-guide.md)
- [Requirements Traceability Matrix](./testing/requirements-traceability-matrix.md)
- [Test Summary Report](./testing/test-summary-report.md)
- [Demo Seed Plan](./testing/demo-seed-plan.md)
- [Present Demo Script](./testing/present-demo-script.md)

## Ghi Chú Khi Cập Nhật Docs

- Nếu đổi endpoint, DTO hoặc response: cập nhật file `docs/api/api-spec-<service>.md`.
- Nếu đổi workflow test/demo: cập nhật file phù hợp trong `docs/testing/`.
- Nếu đổi config key: cập nhật [Consul Workflow](./devops/consul-workflow.md).
- Nếu đổi gateway/auth/frontend flow: cập nhật [Kong + Frontend Integration](./api/kong-frontend-integration.md).
- Nếu đổi kiến trúc/layer/database convention: cập nhật [DDD + Clean Architecture Conventions](./architecture/clean-ddd-conventions.md).
- Nếu đổi hạ tầng/deploy cloud: cập nhật [Azure AKS Deployment](./devops/azure-aks-deployment.md), [Azure GitHub Actions Setup](./devops/azure-github-actions-setup.md) và [Azure Demo Runbook](./devops/azure-demo-runbook.md).
- Nếu đổi cách chạy hệ thống: cập nhật [README root](../README.md).
