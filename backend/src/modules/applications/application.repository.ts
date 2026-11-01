import type {
  ApplicationResponse,
  CreateApplicationInput,
  UpdateApplicationInput,
  UserRole,
} from '@ogulix/shared';

export type ApplicationRecord = Omit<ApplicationResponse, 'createdAt' | 'updatedAt'> & {
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
};

export type ApplicationListQuery = {
  ownerId?: string;
  skip: number;
  take: number;
};

export interface ApplicationRepository {
  list(query: ApplicationListQuery): Promise<ApplicationResponse[]>;
  count(ownerId?: string): Promise<number>;
  findActiveById(applicationId: string): Promise<ApplicationRecord | null>;
  create(ownerId: string, input: CreateApplicationInput): Promise<ApplicationRecord>;
  update(applicationId: string, input: UpdateApplicationInput): Promise<ApplicationRecord>;
  archive(applicationId: string): Promise<ApplicationRecord>;
}

export type ApplicationActor = {
  userId: string;
  role: UserRole;
};
