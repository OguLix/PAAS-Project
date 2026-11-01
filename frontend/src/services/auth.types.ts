/**
 * Auth payload shapes used by the frontend.
 *
 * `docs/design/api-contract.md` lists the `/auth/*` endpoints and fixes the
 * response envelope, but it does not define their request or response bodies
 * yet. The shapes below are the frontend's current assumption, isolated in this
 * file so a single edit corrects every caller once Backend 1 publishes the DTOs.
 * Do not copy these types into other modules.
 */

export type UserRole = 'USER' | 'ADMIN';

export type AuthUser = {
  id: string;
  email: string;
  role: UserRole;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type RegisterInput = {
  email: string;
  password: string;
};

export type MeResponse = {
  user: AuthUser;
};

export type AuthApi = {
  me: () => Promise<MeResponse>;
  login: (input: LoginInput) => Promise<MeResponse>;
  register: (input: RegisterInput) => Promise<MeResponse>;
  logout: () => Promise<void>;
};
