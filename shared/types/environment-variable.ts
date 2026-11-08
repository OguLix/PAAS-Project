/** Environment-variable metadata. Values are never returned by the API. */
export type EnvironmentVariableSummary = {
  key: string;
  isSecret: boolean;
  createdAt: string;
  updatedAt: string;
};
