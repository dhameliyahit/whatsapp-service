import { OAuth2Client } from 'google-auth-library';
import { User, IUserDocument } from '../models/user.model';
import { env } from '../config/env';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt.util';

const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);

export interface GoogleAuthResult {
  user: IUserDocument;
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  /**
   * Verify Google ID token and return user profile details
   */
  async verifyGoogleToken(idToken: string) {
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.sub || !payload.email) {
        throw new Error('Invalid Google token payload.');
      }

      return {
        googleId: payload.sub,
        email: payload.email,
        name: payload.name || payload.given_name || 'User',
        givenName: payload.given_name,
        familyName: payload.family_name,
        picture: payload.picture || '',
        emailVerified: !!payload.email_verified,
      };
    } catch (error: any) {
      throw new Error(`Google token verification failed: ${error.message}`);
    }
  }

  /**
   * Authenticate or register user via Google OAuth credential
   */
  async authenticateWithGoogle(idToken: string): Promise<GoogleAuthResult> {
    const googleProfile = await this.verifyGoogleToken(idToken);

    // Find existing user by googleId or email
    let user = await User.findOne({
      $or: [{ googleId: googleProfile.googleId }, { email: googleProfile.email }],
    });

    if (user) {
      // Update profile info
      user.googleId = googleProfile.googleId;
      user.name = googleProfile.name;
      user.picture = googleProfile.picture || user.picture;
      user.emailVerified = googleProfile.emailVerified;
      user.lastLoginAt = new Date();
    } else {
      // Create new user
      user = new User({
        googleId: googleProfile.googleId,
        email: googleProfile.email,
        name: googleProfile.name,
        givenName: googleProfile.givenName,
        familyName: googleProfile.familyName,
        picture: googleProfile.picture,
        emailVerified: googleProfile.emailVerified,
        role: 'user',
        status: 'active',
        lastLoginAt: new Date(),
      });
    }

    // Generate JWT access & refresh tokens
    const accessToken = generateAccessToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    const refreshToken = generateRefreshToken(user._id.toString());
    user.refreshToken = refreshToken;
    await user.save();

    return { user, accessToken, refreshToken };
  }

  /**
   * Refresh session tokens using a valid refresh token
   */
  async refreshSession(token: string): Promise<{ accessToken: string; refreshToken: string }> {
    const decoded = verifyRefreshToken(token);
    const user = await User.findById(decoded.userId).select('+refreshToken');

    if (!user || user.refreshToken !== token) {
      throw new Error('Invalid or expired refresh token.');
    }

    const accessToken = generateAccessToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    const newRefreshToken = generateRefreshToken(user._id.toString());
    user.refreshToken = newRefreshToken;
    await user.save();

    return { accessToken, refreshToken: newRefreshToken };
  }

  /**
   * Logout user by invalidating stored refresh token
   */
  async logout(userId: string): Promise<void> {
    await User.findByIdAndUpdate(userId, { $unset: { refreshToken: 1 } });
  }
}

export const authService = new AuthService();
