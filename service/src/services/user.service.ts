import { User, IUserDocument } from '../models/user.model';

export class UserService {
  async getUserById(userId: string): Promise<IUserDocument | null> {
    return User.findById(userId);
  }

  async getUserByEmail(email: string): Promise<IUserDocument | null> {
    return User.findOne({ email });
  }

  async updateProfile(userId: string, updateData: Partial<{ name: string; picture: string }>): Promise<IUserDocument | null> {
    return User.findByIdAndUpdate(userId, { $set: updateData }, { new: true, runValidators: true });
  }

  async getAllUsers(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    const [users, total] = await Promise.all([
      User.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
      User.countDocuments(),
    ]);

    return {
      users,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }
}

export const userService = new UserService();
