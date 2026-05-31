# Jenkins DORA Integration

Jenkins DORA integration kết nối Jenkins vào cùng cơ chế đo DORA của dự án.

Sau khi GitHub Actions deploy đã ghi `deployment event` JSON, Jenkins cũng ghi dữ liệu deploy từ self-hosted CI về cùng schema.

## 1. Mục tiêu

- Jenkins deploy staging/production cũng tạo deployment event.
- Event Jenkins có cùng schema với GitHub Actions event.
- Jenkins archive event JSON sau mỗi deploy.
- DORA report có thể đọc event Jenkins nếu event được tải/copy vào `reports/deployments/`.

Điểm quan trọng: Jenkins không cần một hệ thống DORA riêng. Jenkins chỉ cần ghi đúng event JSON, còn `scripts/devops-dora-report.ts` đọc chung.

## 2. File liên quan

- `Jenkinsfile`
- `scripts/devops-record-deployment.js`
- `scripts/devops-dora-report.ts`
- `guides/devops/DEPLOYMENT-EVENT-STORE.md`
- `guides/devops/JENKINS-DOCKER-COMPOSE.md`

## 3. Jenkinsfile đã ghi event như thế nào

Trong stage `Deploy Staging` và `Deploy Production`, Jenkins ghi lại thời điểm bắt đầu deploy:

```groovy
script {
  env.DEPLOYMENT_STARTED_AT = new Date().format("yyyy-MM-dd'T'HH:mm:ss'Z'", TimeZone.getTimeZone('UTC'))
}
```

Sau stage deploy, block `post { always { ... } }` luôn chạy để ghi event, kể cả khi deploy fail:

```groovy
post {
  always {
    script {
      withEnv([
        'DEPLOYMENT_SOURCE=jenkins',
        'DEPLOYMENT_PROVIDER=jenkins',
        'DEPLOYMENT_ENVIRONMENT=staging',
        'DEPLOYMENT_TYPE=docker-compose',
        'DEPLOYMENT_TARGET=ssh-vm',
        "DEPLOYMENT_IMAGE_TAG=${env.IMAGE_TAG ?: ''}",
        "DEPLOYMENT_GIT_SHA=${env.GIT_COMMIT ?: env.IMAGE_TAG ?: ''}",
        "DEPLOYMENT_STATUS=${currentBuild.currentResult?.toLowerCase() ?: 'unknown'}",
      ]) {
        sh 'npm run deployment:record || true'
      }
    }
    archiveArtifacts artifacts: 'reports/deployments/events/*.json', allowEmptyArchive: true
  }
}
```

`always()` rất quan trọng vì deploy thất bại cũng là dữ liệu để tính Change Failure Rate.

## 4. Event Jenkins trông như thế nào

Ví dụ event Jenkins:

```json
{
  "schemaVersion": 1,
  "source": "jenkins",
  "provider": "jenkins",
  "workflow": "luyen-thi-lai-xe/main",
  "workflowRunId": "152",
  "workflowRunAttempt": "152",
  "job": "Deploy Staging",
  "environment": "staging",
  "deploymentType": "docker-compose",
  "deploymentTarget": "ssh-vm",
  "gitSha": "df2af3a8eb40...",
  "imageTag": "df2af3a",
  "branch": "main",
  "status": "success",
  "startedAt": "2026-05-31T10:30:00Z",
  "finishedAt": "2026-05-31T10:57:00Z",
  "deployUrl": "https://jenkins.example.com/job/luyen-thi-lai-xe/152/"
}
```

Các giá trị như `BUILD_URL`, `BUILD_NUMBER`, `JOB_NAME`, `BRANCH_NAME`, `GIT_COMMIT` được `scripts/devops-record-deployment.js` tự nhận từ Jenkins nếu có.

## 5. Cách dùng Jenkins artifact trong DORA report

Sau khi Jenkins job chạy xong:

1. Mở Jenkins build.
2. Tải artifact:

```text
reports/deployments/events/*.json
```

3. Đặt các file JSON vào repo local:

```text
reports/deployments/events/
```

4. Chạy:

```bash
npm run dora:report
```

DORA report sẽ đọc event Jenkins cùng với event GitHub Actions.

## 6. Khi nào cần Jenkins API

Cách hiện tại đủ cho MVP/demo vì Jenkins đã archive event JSON. Nếu Jenkins trở thành pipeline chính, nên làm thêm Jenkins API integration:

- Gọi Jenkins REST API để lấy build history.
- Tự tải artifact `reports/deployments/events/*.json`.
- Gom nhiều job Jenkins vào `reports/deployments/`.
- Sau đó chạy `npm run dora:report`.

Endpoint Jenkins thường dùng:

```text
GET /job/<job-name>/<build-number>/api/json
GET /job/<job-name>/<build-number>/artifact/reports/deployments/events/<file>.json
```

## 7. Demo với giảng viên

Lời thoại gợi ý:

> Dự án hỗ trợ cả GitHub Actions và Jenkins. Điểm hay là hai pipeline không tạo hai kiểu dữ liệu khác nhau. Sau deploy, cả hai đều ghi deployment event JSON cùng schema. DORA report chỉ cần đọc event store là có thể tính Deployment Frequency, Lead Time và Change Failure Rate, bất kể deploy đến từ managed CI hay self-hosted CI.

Demo nhanh:

1. Mở `Jenkinsfile`.
2. Chỉ stage `Deploy Staging` hoặc `Deploy Production`.
3. Chỉ block `post { always { ... npm run deployment:record ... } }`.
4. Mở Jenkins build artifact `reports/deployments/events/*.json`.
5. Copy event vào `reports/deployments/events/`.
6. Chạy:

```bash
npm run dora:report
```

## 8. Việc nên làm tiếp

- Tạo script tự tải Jenkins artifacts bằng Jenkins API.
- Thêm Jenkins credentials read-only cho DORA collector.
- Tạo rollback job Jenkins có tham số `IMAGE_TAG` và ghi `DEPLOYMENT_ROLLBACK_OF`.
- Đồng bộ Jenkins event artifacts lên Cloud Storage hoặc database.
