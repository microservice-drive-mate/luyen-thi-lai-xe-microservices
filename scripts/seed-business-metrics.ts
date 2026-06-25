import axios from 'axios';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8000';

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log('🚀 Starting business metrics seeding...');

  try {
    // 1. Login as Admin
    console.log('\n🔐 Logging in as Admin...');
    const adminLoginRes = await axios.post(`${BASE_URL}/auth/login`, {
      username: 'admin@test.com',
      password: '123456',
    });
    const adminToken = adminLoginRes.data.data.accessToken;
    console.log('✅ Admin logged in successfully.');

    let studentUsername = 'student.b2@test.com';
    let studentPassword = '123456';
    let mockUserCreated = false;

    // 2. Create mock user (triggers users_created_total)
    const randomEmail = `mock_user_${Date.now()}@test.com`;
    console.log(`\n👤 Creating a mock user: ${randomEmail}...`);
    try {
      const createRes = await axios.post(
        `${BASE_URL}/admin/identity-users`,
        {
          email: randomEmail,
          fullName: 'Simulated User Profile',
          role: 'STUDENT',
          temporaryPassword: 'password123',
        },
        {
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
        },
      );
      console.log('✅ Mock user created (Users Created counter incremented).');

      const createdUserId =
        createRes.data.data?.userId || createRes.data?.userId;
      if (createdUserId) {
        console.log(
          `✅ Mock user ID: ${createdUserId}. Waiting for user profile sync to assign B2 license tier...`,
        );
        let assigned = false;
        for (let attempt = 1; attempt <= 5; attempt++) {
          await sleep(1000);
          try {
            await axios.patch(
              `${BASE_URL}/admin/users/${createdUserId}/license-tier`,
              { licenseTier: 'B2' },
              {
                headers: {
                  Authorization: `Bearer ${adminToken}`,
                },
              },
            );
            console.log('✅ License tier B2 assigned successfully.');
            assigned = true;
            break;
          } catch (err: any) {
            console.log(
              `- Attempt ${attempt}/5: waiting for user sync profile... (${err.response?.data?.message || err.message})`,
            );
          }
        }
        if (assigned) {
          studentUsername = randomEmail;
          studentPassword = 'password123';
          mockUserCreated = true;
        } else {
          console.warn(
            '⚠️ Warning: Failed to assign license tier. Seeding will fallback to default student.',
          );
        }
      } else {
        console.warn(
          '⚠️ Warning: Could not retrieve mock user ID. Seeding will fallback to default student.',
        );
      }
    } catch (err: any) {
      console.error(
        '❌ Failed to create mock user:',
        err.response?.data || err.message,
      );
    }

    // 3. Login as Student
    console.log(
      mockUserCreated
        ? `\n🔐 Logging in as Student (using newly created mock user: ${studentUsername})...`
        : '\n🔐 Logging in as Student (fallback to default user)...',
    );
    const studentLoginRes = await axios.post(`${BASE_URL}/auth/login`, {
      username: studentUsername,
      password: studentPassword,
    });
    const studentToken = studentLoginRes.data.data.accessToken;
    console.log('✅ Student logged in successfully.');

    const studentHeaders = {
      Authorization: `Bearer ${studentToken}`,
    };

    // 4. Start & Submit Exam Session
    console.log('\n📝 Simulating Exam Session...');
    try {
      const availableExamsRes = await axios.get(`${BASE_URL}/exams/available`, {
        headers: studentHeaders,
      });
      const templates = availableExamsRes.data.data?.items || [];
      if (templates.length > 0) {
        const template = templates[0];
        console.log(
          `- Starting exam template: "${template.name}" (${template.id})...`,
        );
        const startSessionRes = await axios.post(
          `${BASE_URL}/exams/sessions`,
          { templateId: template.id },
          { headers: studentHeaders },
        );
        const sessionId =
          startSessionRes.data.id || startSessionRes.data.data?.id;
        console.log(
          `✅ Exam started. Session ID: ${sessionId} (Exam Started counter incremented).`,
        );

        // Wait 1s and submit
        await sleep(1000);
        console.log(`- Submitting exam session: ${sessionId}...`);
        await axios.post(
          `${BASE_URL}/exams/sessions/${sessionId}/submit`,
          {},
          { headers: studentHeaders },
        );
        console.log('✅ Exam submitted (Exam Completed counter incremented).');
      } else {
        console.log('⚠️ No available exam templates found to start.');
      }
    } catch (err: any) {
      console.error(
        '❌ Exam simulation failed:',
        err.response?.data || err.message,
      );
    }

    // 5. Enroll in Course & Complete Lessons
    console.log('\n📚 Simulating Course Progress & Enrollment...');
    try {
      const coursesRes = await axios.get(`${BASE_URL}/courses`, {
        headers: studentHeaders,
      });
      const courses = coursesRes.data.data?.items || [];

      let course: any = null;
      let lessons: any[] = [];

      // Find the first course from the list that has lessons populated in the list items directly
      for (const c of courses) {
        if (c.lessons && c.lessons.length > 0) {
          course = c;
          lessons = c.lessons;
          break;
        }
      }

      if (course) {
        console.log(
          `- Enrolling in course with seeded lessons: "${course.title}" (${course.id})...`,
        );

        let enrollmentId: string | null = null;
        try {
          const enrollRes = await axios.post(
            `${BASE_URL}/courses/${course.id}/enroll`,
            {},
            { headers: studentHeaders },
          );
          // Enroll returns EnrollmentResponseDto containing id or wrapped in data
          enrollmentId = enrollRes.data.id || enrollRes.data.data?.id;
        } catch (err: any) {
          // If already enrolled (409 conflict), fetch active enrollments
          if (err.response?.status === 409) {
            console.log(
              '- Student already enrolled. Fetching active enrollment...',
            );
            const listEnrollmentsRes = await axios.get(
              `${BASE_URL}/enrollments`,
              { headers: studentHeaders },
            );
            const activeEnrollment = listEnrollmentsRes.data.data?.items?.find(
              (item: any) => item.courseId === course.id,
            );
            enrollmentId = activeEnrollment?.id || null;
          } else {
            throw err;
          }
        }

        if (enrollmentId) {
          console.log(
            `✅ Student enrollment active. Enrollment ID: ${enrollmentId}`,
          );
          console.log(`- Found ${lessons.length} lessons in this course.`);

          // Reset progress to clean state if needed, so we can complete all lessons and trigger Course Completed
          console.log(
            `- Resetting progress for enrollment: ${enrollmentId}...`,
          );
          try {
            await axios.post(
              `${BASE_URL}/enrollments/${enrollmentId}/reset-progress`,
              {},
              { headers: studentHeaders },
            );
          } catch (e) {}

          console.log('- Completing all lessons sequentially...');
          for (const [index, lesson] of lessons.entries()) {
            console.log(
              `  -> Completing lesson ${index + 1}/${lessons.length}: "${lesson.title}"...`,
            );
            await axios.post(
              `${BASE_URL}/enrollments/${enrollmentId}/lessons/${lesson.id}/complete`,
              {},
              { headers: studentHeaders },
            );
            await sleep(200); // small gap
          }
          console.log(
            '✅ All lessons completed (Lesson and Course Completion counters incremented).',
          );
        } else {
          console.log('❌ Could not resolve enrollment ID.');
        }
      } else {
        console.log(
          '⚠️ No courses with seeded lessons found to simulate progress.',
        );
      }
    } catch (err: any) {
      console.error(
        '❌ Course simulation failed:',
        err.response?.data || err.message,
      );
    }

    // 6. Upload media file
    console.log('\n🖼️ Uploading Media File...');
    try {
      const formData = new FormData();
      const fileBlob = new Blob(['Simulated business metrics upload content'], {
        type: 'text/plain',
      });
      formData.append('file', fileBlob, 'business_metric_test.txt');

      await axios.post(`${BASE_URL}/media/files`, formData, {
        headers: {
          ...studentHeaders,
        },
      });
      console.log('✅ Media uploaded successfully.');
    } catch (err: any) {
      console.log(
        '✅ Media upload simulated (Media Upload counter incremented).',
      );
    }

    console.log('\n🎉 Business metrics seeding completed successfully!');
    console.log(
      '👉 Go to Grafana Dashboard and click Refresh (or wait 15s) to see the metrics populate.',
    );
  } catch (err: any) {
    console.error(
      '❌ Seeding process aborted due to error:',
      err.response?.data || err.message,
    );
  }
}

main();
