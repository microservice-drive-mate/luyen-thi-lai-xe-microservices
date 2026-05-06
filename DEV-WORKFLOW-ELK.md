# Quy trình làm việc với ELK Stack cho Developer

Tài liệu này hướng dẫn chi tiết cách đội ngũ phát triển (Dev Team) sử dụng hệ thống ELK Stack để theo dõi, debug và quản lý log hiệu quả trong quá trình phát triển Microservices.

---

## 1. Địa chỉ truy cập hệ thống

Hệ thống Logging tập trung được quản lý qua giao diện **Kibana**:

- **URL**: [http://localhost:5601](http://localhost:5601)
- **Menu chính**: Nhấn biểu tượng 3 gạch ngang (góc trên bên trái) -> **Analytics** -> **Discover**. Đây là nơi bạn sẽ dành 90% thời gian để xem log.

---

## 2. Tìm kiếm và Lọc Log (KQL - Kibana Query Language)

Tại ô tìm kiếm ở trên cùng, bạn hãy sử dụng các câu lệnh sau để lọc dữ liệu nhanh chóng thay vì đọc bằng mắt:

### Các ví dụ tìm kiếm thông dụng:

| Mục đích                         | Câu lệnh KQL                                             |
| :------------------------------- | :------------------------------------------------------- |
| **Lọc theo Service**             | `context : "Identity controller"`                        |
| **Lọc theo mức độ (Level)**      | `level : "error"` hoặc `level : "warn"`                  |
| **Tìm lỗi trong Service cụ thể** | `level : "error" AND context : "Identity controller"`    |
| **Tìm theo nội dung tin nhắn**   | `message : "login"` (tìm các log có chứa chữ login)      |
| **Tìm theo dữ liệu cấu trúc**    | `userId : 123` (Nếu bạn ghi log dạng object chứa userId) |

> **Mẹo**: Sử dụng dấu `*` để tìm kiếm tương đối, ví dụ `message : *auth*` sẽ tìm tất cả log có từ "auth".

---

## 3. Quy trình Debug lỗi (Workflow)

Khi một tính năng gặp lỗi hoặc bạn muốn kiểm tra luồng dữ liệu, hãy làm theo các bước sau:

### Bước 1: Ghi log có cấu trúc trong Code

Thay vì ghi log dạng text thuần túy, hãy truyền thêm một Object chứa các thông tin quan trọng (ID, Request body, v.v.).

```typescript
this.logger.error({
  message: "Lỗi khi xử lý đăng nhập",
  userId: user.id,
  ip: request.ip,
  errorDetail: error.message,
});
```

### Bước 2: Thực hiện hành động trên App

Chạy API hoặc thao tác trên UI để kích hoạt dòng log đó.

### Bước 3: Kiểm tra trên Kibana Discover

- Nhấn **Refresh** (góc trên bên phải).
- Tìm dòng log mới nhất. Nhấn vào biểu tượng **mở rộng (>)** ở đầu dòng log để xem toàn bộ dữ liệu dưới dạng JSON.
- Kibana sẽ tự động tách `userId`, `ip`, `errorDetail` thành các trường riêng biệt để bạn dễ nhìn.

---

## 4. Các quy tắc chung cho Team (Standardization)

Để hệ thống log thực sự hữu ích, toàn bộ team cần thống nhất các quy tắc sau:

1. **Sử dụng Logger chung**: Tuyệt đối không dùng `console.log()`. Hãy sử dụng `private readonly logger = new Logger(ContextName.name)` của NestJS.
2. **Chọn đúng Log Level**:
   - `Error`: Hệ thống gặp sự cố không thể tiếp tục (VD: Mất kết nối DB).
   - `Warn`: Sự cố nhẹ, hệ thống vẫn chạy nhưng cần lưu ý (VD: Sai mật khẩu quá nhiều lần).
   - `Log/Info`: Các sự kiện bình thường (VD: Khởi động service thành công).
   - `Debug`: Các thông tin chi tiết phục vụ quá trình phát triển (VD: Request payload).
3. **Log Object thay vì String**: ELK mạnh nhất ở khả năng phân tích dữ liệu cấu trúc. Hãy luôn cố gắng log dưới dạng `{ message: string, data: object }`.

---

## 5. Sử dụng Dashboard (Giám sát tổng quan)

Ngoài việc xem log chi tiết, bạn có thể vào mục **Dashboard** để:

- Theo dõi biểu đồ số lượng Request theo thời gian.
- Xem tỷ lệ phần trăm các lỗi (Error vs Info).
- Thống kê các API bị gọi lỗi nhiều nhất.

---

## 6. Lưu ý về tài nguyên (Resource)

ELK Stack (đặc biệt là Elasticsearch) tiêu tốn khá nhiều RAM.

- **Nếu máy bị lag**: Hãy tạm dừng ELK bằng lệnh `docker-compose stop elasticsearch logstash kibana`.
- **Dọn dẹp dữ liệu**: Định kỳ, Elasticsearch sẽ tạo nhiều Index hàng ngày. Nếu ổ cứng bị đầy, bạn có thể vào **Stack Management** > **Index Management** để xóa các index cũ.

---

_Tài liệu này được tạo tự động để hỗ trợ quy trình phát triển dự án._
