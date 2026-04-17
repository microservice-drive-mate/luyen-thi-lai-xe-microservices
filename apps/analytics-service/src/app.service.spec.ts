import { beforeEach, describe, expect, it } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { AppService } from './app.service';

describe('AppService', () => {
  let service: AppService;

  // 1. Khởi tạo module giả lập trước mỗi bài test
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AppService], // Đưa service vào để NestJS khởi tạo
    }).compile();

    // Lấy instance của service ra để sử dụng
    service = module.get<AppService>(AppService);
  });

  // 2. Định nghĩa một ca kiểm thử (test case)
  it('nên được khởi tạo thành công', () => {
    expect(service).toBeDefined();
  });

  // 3. Kiểm tra logic của hàm getHello
  describe('getHello', () => {
    it('nên trả về chuỗi "Hello World!"', () => {
      const result = service.getHello();
      expect(result).toBe('Hello World!');
    });
  });
});
