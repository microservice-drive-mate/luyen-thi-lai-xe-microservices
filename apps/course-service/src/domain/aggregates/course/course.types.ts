export enum LicenseCategory {
  A1 = 'A1',
  A2 = 'A2',
  B1 = 'B1',
  B2 = 'B2',
  C = 'C',
  D = 'D',
  E = 'E',
  F = 'F',
}

export enum CourseStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
}

export interface CreateCourseProps {
  title: string;
  description?: string | null;
  licenseCategory: LicenseCategory;
  duration?: string | null;
  tuitionFee?: number;
  capacity?: number | null;
  createdById: string;
  instructorIds?: string[];
  requirement?: CreateRequirementProps | null;
}

export interface ReconstituteCourseProps {
  id: string;
  title: string;
  description: string | null;
  licenseCategory: LicenseCategory;
  totalLessons: number;
  duration: string | null;
  tuitionFee: number;
  capacity: number | null;
  status: CourseStatus;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  lessons: ReconstituteLessonProps[];
  instructorIds: string[];
  requirement: ReconstituteRequirementProps | null;
  materials: ReconstituteMaterialProps[];
}

export interface UpdateCourseProps {
  title?: string;
  description?: string | null;
  duration?: string | null;
  tuitionFee?: number;
  capacity?: number | null;
}

export interface CreateLessonProps {
  title: string;
  content?: string | null;
  order: number;
}

export interface ReconstituteLessonProps {
  id: string;
  courseId: string;
  title: string;
  content: string | null;
  order: number;
  createdAt: Date;
}

export interface UpdateLessonProps {
  title?: string;
  content?: string | null;
  order?: number;
}

export interface CreateRequirementProps {
  minAge?: number | null;
  prerequisites?: string | null;
  attendanceRate?: number;
  minPassScore?: number;
  requiredExams?: number;
}

export interface ReconstituteRequirementProps {
  id: string;
  courseId: string;
  minAge: number | null;
  prerequisites: string | null;
  attendanceRate: number;
  minPassScore: number;
  requiredExams: number;
}

export interface ReconstituteMaterialProps {
  id: string;
  courseId: string;
  title: string;
  fileUrl: string | null;
  type: string | null;
  createdAt: Date;
}

export interface CreateMaterialProps {
  title: string;
  fileUrl?: string | null;
  type?: string | null;
}
