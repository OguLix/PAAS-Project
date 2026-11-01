import type { UserRole } from '@ogulix/shared';

export type AuthContext = {
  userId: string;
  email: string;
  role: UserRole;
  sessionId: string;
};

declare module 'express-serve-static-core' {
  interface Request {
    auth?: AuthContext;
  }
}
