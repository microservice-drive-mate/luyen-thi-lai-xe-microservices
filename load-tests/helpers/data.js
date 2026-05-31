/**
 * ============================================================
 * HELPER TẠO DỮ LIỆU TEST - RANDOM DATA GENERATORS
 * ============================================================
 *
 * File này cung cấp các hàm tạo dữ liệu ngẫu nhiên cho test:
 * - Email, tên người dùng ngẫu nhiên
 * - Dữ liệu bài thi, câu hỏi, khóa học
 * - Dữ liệu đăng ký, bài nộp
 */

/**
 * Tạo chuỗi ngẫu nhiên với độ dài và ký tự tùy chỉnh
 * @param {number} length - Độ dài chuỗi
 * @param {string} chars - Tập ký tự sử dụng
 * @returns {string}
 */
export function randomString(
  length = 10,
  chars = 'abcdefghijklmnopqrstuvwxyz0123456789',
) {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Tạo số nguyên ngẫu nhiên trong khoảng [min, max]
 * @param {number} min - Giá trị nhỏ nhất
 * @param {number} max - Giá trị lớn nhất
 * @returns {number}
 */
export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Chọn ngẫu nhiên một phần tử từ mảng
 * @param {Array} arr - Mảng đầu vào
 * @returns {*} Phần tử được chọn
 */
export function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Tạo địa chỉ email ngẫu nhiên cho test
 * Mỗi email là duy nhất nhờ timestamp + chuỗi ngẫu nhiên
 * @returns {string}
 */
export function randomEmail() {
  const timestamp = Date.now();
  const suffix = randomString(6);
  return `testuser_${timestamp}_${suffix}@loadtest.com`;
}

/**
 * Tạo tên tiếng Việt ngẫu nhiên
 * @returns {string}
 */
export function randomVietnameseName() {
  const ho = [
    'Nguyễn',
    'Trần',
    'Lê',
    'Phạm',
    'Hoàng',
    'Huỳnh',
    'Phan',
    'Vũ',
    'Võ',
    'Đặng',
  ];
  const tenDem = [
    'Văn',
    'Thị',
    'Đức',
    'Minh',
    'Hoàng',
    'Quốc',
    'Thanh',
    'Ngọc',
    'Kim',
    'Anh',
  ];
  const ten = [
    'An',
    'Bình',
    'Cường',
    'Dũng',
    'Hà',
    'Hải',
    'Hưng',
    'Lan',
    'Mai',
    'Nam',
    'Phong',
    'Quân',
    'Tâm',
    'Thảo',
    'Tuấn',
    'Vy',
    'Xuân',
    'Yến',
  ];

  return `${randomItem(ho)} ${randomItem(tenDem)} ${randomItem(ten)}`;
}

/**
 * Tạo số điện thoại Việt Nam ngẫu nhiên
 * @returns {string}
 */
export function randomPhoneNumber() {
  const prefixes = [
    '090',
    '091',
    '093',
    '094',
    '096',
    '097',
    '098',
    '032',
    '033',
    '034',
    '035',
    '036',
    '037',
    '038',
    '039',
    '070',
    '076',
    '077',
    '078',
    '079',
  ];
  return randomItem(prefixes) + randomString(7, '0123456789');
}

/**
 * Tạo dữ liệu đăng ký người dùng mới
 * @returns {object} Dữ liệu đăng ký
 */
export function generateRegistrationData() {
  return {
    email: randomEmail(),
    password: 'Test@123456',
    fullName: randomVietnameseName(),
    phoneNumber: randomPhoneNumber(),
  };
}

/**
 * Tạo dữ liệu bài thi ngẫu nhiên
 * Bao gồm tiêu đề, mô tả, thời gian, số câu hỏi, v.v.
 * @returns {object} Dữ liệu bài thi
 */
export function generateExamData() {
  const examTypes = ['A1', 'A2', 'B1', 'B2', 'C', 'D', 'E', 'F'];
  const selectedType = randomItem(examTypes);
  const questionCount = randomInt(20, 45);

  return {
    title: `Đề thi lái xe hạng ${selectedType} - ${randomString(5).toUpperCase()}`,
    description: `Đề thi thử giấy phép lái xe hạng ${selectedType} gồm ${questionCount} câu hỏi`,
    type: selectedType,
    duration: randomInt(19, 30) * 60, // Thời gian tính bằng giây (19-30 phút)
    totalQuestions: questionCount,
    passingScore: Math.ceil(questionCount * 0.8), // Điểm đạt là 80%
    isActive: true,
  };
}

/**
 * Tạo dữ liệu câu hỏi thi ngẫu nhiên
 * Câu hỏi bao gồm: nội dung, 4 đáp án, đáp án đúng, giải thích
 * @returns {object} Dữ liệu câu hỏi
 */
export function generateQuestionData() {
  const categories = [
    'Khái niệm và quy tắc',
    'Nghiệp vụ vận tải',
    'Văn hóa giao thông',
    'Kỹ thuật lái xe',
    'Cấu tạo và sửa chữa',
    'Biển báo đường bộ',
    'Sa hình',
  ];

  const correctAnswer = randomInt(0, 3);

  return {
    content: `Câu hỏi test ${randomString(8)}: Theo quy định, người điều khiển phương tiện giao thông phải làm gì khi gặp tình huống này?`,
    category: randomItem(categories),
    answers: [
      {
        content: `Đáp án A - ${randomString(5)}`,
        isCorrect: correctAnswer === 0,
      },
      {
        content: `Đáp án B - ${randomString(5)}`,
        isCorrect: correctAnswer === 1,
      },
      {
        content: `Đáp án C - ${randomString(5)}`,
        isCorrect: correctAnswer === 2,
      },
      {
        content: `Đáp án D - ${randomString(5)}`,
        isCorrect: correctAnswer === 3,
      },
    ],
    explanation: `Giải thích: Đây là câu hỏi test được tạo tự động. Đáp án đúng là ${String.fromCharCode(65 + correctAnswer)}.`,
    isCritical: Math.random() < 0.1, // 10% là câu điểm liệt
  };
}

/**
 * Tạo dữ liệu bài nộp (submission) cho một bài thi
 * Mỗi câu trả lời là ngẫu nhiên, mô phỏng thí sinh thật
 *
 * @param {number} totalQuestions - Tổng số câu hỏi
 * @param {Array<string>} questionIds - Danh sách ID câu hỏi
 * @returns {object} Dữ liệu bài nộp
 */
export function generateExamSubmission(totalQuestions = 30, questionIds = []) {
  const answers = [];

  for (let i = 0; i < totalQuestions; i++) {
    answers.push({
      questionId: questionIds[i] || `question_${i + 1}`,
      selectedAnswer: randomInt(0, 3), // Chọn ngẫu nhiên 1 trong 4 đáp án
    });
  }

  return {
    answers: answers,
    submittedAt: new Date().toISOString(),
  };
}

/**
 * Tạo dữ liệu khóa học ngẫu nhiên
 * @returns {object} Dữ liệu khóa học
 */
export function generateCourseData() {
  const courseTypes = ['A1', 'A2', 'B1', 'B2', 'C', 'D'];
  const selectedType = randomItem(courseTypes);

  return {
    title: `Khóa học lái xe hạng ${selectedType} - ${randomString(4).toUpperCase()}`,
    description: `Khóa học đào tạo lái xe hạng ${selectedType} toàn diện, bao gồm lý thuyết và thực hành`,
    type: selectedType,
    totalLessons: randomInt(10, 30),
    duration: `${randomInt(2, 6)} tháng`,
    price: randomInt(5, 30) * 1000000, // 5-30 triệu VND
    isActive: true,
  };
}

/**
 * Tạo dữ liệu ghi danh khóa học
 * @param {string} courseId - ID khóa học
 * @returns {object} Dữ liệu ghi danh
 */
export function generateEnrollmentData(courseId) {
  return {
    courseId: courseId || `course_${randomString(8)}`,
    enrolledAt: new Date().toISOString(),
  };
}

/**
 * Tạo dữ liệu phân trang (pagination) ngẫu nhiên
 * @returns {object} Query params cho phân trang
 */
export function randomPagination() {
  return {
    page: randomInt(1, 5),
    limit: randomItem([10, 20, 50]),
  };
}
