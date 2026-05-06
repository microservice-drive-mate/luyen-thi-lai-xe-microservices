# Hướng dẫn sử dụng ELK Stack & Best Practices Logging

Tài liệu này hướng dẫn cách vận hành hệ thống Logging tập trung (Centralized Logging) sử dụng bộ ba Elasticsearch, Logstash, Kibana (ELK) trong dự án Microservices.

---

## 1. Kiến trúc Logging

Hệ thống sử dụng cơ chế **Push-based Logging**:

- **Microservices**: Sử dụng `winston` và `nest-winston` để định dạng log dưới dạng JSON.
- **Transport**: Log được gửi trực tiếp từ ứng dụng tới Logstash thông qua giao thức **HTTP** (Port 5044).
- **Logstash**: Tiếp nhận, xử lý sơ bộ và đẩy vào Elasticsearch theo index hàng ngày (`microservices-logs-YYYY.MM.DD`).
- **Kibana**: Giao diện trực quan hóa để tìm kiếm và phân tích log.

---

## 2. Cách khởi hành (Quick Start)

### Bước 1: Khởi động ELK

```bash
docker-compose up -d elasticsearch logstash kibana
```

_Đợi khoảng 1-2 phút để Elasticsearch sẵn sàng._

### Bước 2: Truy cập Kibana

- URL: [http://localhost:5601](http://localhost:5601)
- Lần đầu sử dụng: Vào **Stack Management** > **Data Views** > Tạo mới với pattern `microservices-logs-*`.

---

## 3. Tích hợp cho Microservice mới

Để tích hợp ELK cho một microservice mới trong dự án, bạn thực hiện 2 bước đơn giản:

### Bước 1: Import AppLoggerModule

Trong file `app.module.ts` của service:

```typescript
import { AppLoggerModule } from "@repo/common";

@Module({
  imports: [
    AppLoggerModule, // Thêm module này vào
    // ... các module khác
  ],
})
export class AppModule {}
```

### Bước 2: Cấu hình useLogger

Trong file `main.ts` của service:

```typescript
import { WINSTON_MODULE_NEST_PROVIDER } from "@repo/common";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Ép NestJS sử dụng Winston thay cho Logger mặc định
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  // ... rest of bootstrap
}
```

---

## 4. Cách sử dụng Logger trong Code

Bạn nên sử dụng class `Logger` mặc định của NestJS. Nhờ bước cấu hình ở trên, NestJS sẽ tự động chuyển hướng các lệnh gọi này tới Winston để gửi lên ELK.

### Cách dùng cơ bản:

```typescript
import { Logger } from '@nestjs/common';

private readonly logger = new Logger(MyService.name);

this.logger.log('Đây là một log thông thường');
this.logger.error('Đây là log lỗi', error.stack);
this.logger.warn('Đây là log cảnh báo');
this.logger.debug('Đây là log debug (chỉ hiện ở dev)');
```

### Structured Logging (Khuyên dùng):

Để ELK phân tích dữ liệu tốt hơn, hãy truyền thêm object chứa thông tin chi tiết:

```typescript
this.logger.log({
  message: "Người dùng đăng nhập thành công",
  userId: user.id,
  ipAddress: req.ip,
  action: "USER_LOGIN",
});
```

---

## 5. Best Practices cho Logging

### ✅ Nên làm:

1. **Sử dụng Log Levels đúng mục đích**:
   - `Error`: Khi có lỗi hệ thống hoặc lỗi nghiệp vụ nghiêm trọng.
   - `Warn`: Khi có điều gì đó bất thường nhưng hệ thống vẫn chạy được.
   - `Log/Info`: Ghi lại các cột mốc quan trọng (User created, Order placed).
   - `Debug`: Ghi lại thông tin chi tiết để hỗ trợ sửa lỗi (chỉ dùng ở môi trường dev).
2. **Contextual Logging**: Luôn gắn `Context` (tên Class/Function) khi khởi tạo Logger để biết log phát ra từ đâu.
3. **Structured Data**: Thay vì ghi chuỗi text dài, hãy ghi object JSON để Kibana có thể lọc theo từng field (VD: lọc tất cả log có `userId = 123`).
4. **Correlation ID**: (Nâng cao) Gắn thêm `traceId` vào mỗi log trong cùng một request để theo dõi luồng dữ liệu đi qua nhiều microservices.

### ❌ Không nên làm:

1. **Không log thông tin nhạy cảm**: Tuyệt đối không log Password, Token, Mã PIN, hay thông tin cá nhân khách hàng (PII) lên ELK.
2. **Tránh Log quá nhiều trong vòng lặp**: Có thể gây nghẽn Logstash và tốn dung lượng ổ cứng.
3. **Không dùng `console.log`**: Console log không được quản lý bởi Winston và sẽ khó thu thập/định dạng chuẩn trên ELK.

---

## 6. Xử lý sự cố thường gặp

- **Kibana không thấy log mới**:
  - Kiểm tra xem service đã được build lại với `AppLoggerModule` chưa.
  - Kiểm tra log của container Logstash: `docker logs logstash`.
- **Elasticsearch bị treo**: Thường do hết bộ nhớ. Hãy đảm bảo bạn cấp ít nhất 2GB RAM cho Docker engine.
- **Logstash báo lỗi kết nối**: Kiểm tra biến môi trường `LOGSTASH_HOST` trong file `docker-compose.yaml` (phải là `logstash` nếu chạy trong docker, hoặc `localhost` nếu chạy service ở ngoài).
