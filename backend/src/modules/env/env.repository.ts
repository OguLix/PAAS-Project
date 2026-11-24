export type EnvironmentVariableRecord = {
  id: string;
  applicationId: string;
  key: string;
  isSecret: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export interface EnvironmentVariableRepository {
  listByApplication(applicationId: string): Promise<EnvironmentVariableRecord[]>;
  upsert(
    applicationId: string,
    key: string,
    encryptedValue: string,
    isSecret: boolean,
  ): Promise<EnvironmentVariableRecord>;
  deleteByKey(applicationId: string, key: string): Promise<boolean>;
}
