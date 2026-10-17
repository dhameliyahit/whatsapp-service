export interface UserProfile {
  _id?: string;
  id?: string;
  googleId?: string;
  email: string;
  name: string;
  givenName?: string;
  familyName?: string;
  picture?: string;
  emailVerified?: boolean;
  role?: 'user' | 'admin';
  status?: 'active' | 'suspended' | 'pending';
  lastLoginAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthResponseData {
  user: UserProfile;
  accessToken: string;
  refreshToken: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  timestamp?: string;
}

export interface GoogleAuthResponse {
  credential: string;
  select_by?: string;
}
