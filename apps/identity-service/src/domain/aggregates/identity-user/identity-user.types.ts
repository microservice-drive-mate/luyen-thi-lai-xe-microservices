export enum UserRole {
  ADMIN = 'ADMIN',
  CENTER_MANAGER = 'CENTER_MANAGER',
  INSTRUCTOR = 'INSTRUCTOR',
  STUDENT = 'STUDENT',
}

export interface CreateIdentityUserProps {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
}

export interface ReconstituteIdentityUserProps extends CreateIdentityUserProps {
  isActive: boolean;
  isDeleted: boolean;
  deletedAt: Date | null;
  deletedById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateIdentityUserProps {
  email?: string;
  fullName?: string;
}
