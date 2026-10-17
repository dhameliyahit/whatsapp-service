import crypto from 'crypto';
import mongoose from 'mongoose';
import { ApiKey, IApiKeyDocument } from '../models/apiKey.model';

export class ApiKeyService {
  /**
   * Generates a new cryptographically secure API key
   */
  async createApiKey(userId: string, name: string): Promise<{ apiKey: string; record: IApiKeyDocument }> {
    // Generate secure token: vf_live_<32 hex chars>
    const randomBytes = crypto.randomBytes(24).toString('hex');
    const rawApiKey = `vf_live_${randomBytes}`;
    const keyHash = crypto.createHash('sha256').update(rawApiKey).digest('hex');
    const prefix = `${rawApiKey.substring(0, 11)}••••••••••••••••`;

    const record = new ApiKey({
      userId: new mongoose.Types.ObjectId(userId),
      name: name.trim() || 'Default API Key',
      prefix,
      keyHash,
      status: 'active',
    });

    await record.save();

    return {
      apiKey: rawApiKey,
      record,
    };
  }

  /**
   * List API keys for a user (without exposing secret hash)
   */
  async getUserApiKeys(userId: string): Promise<IApiKeyDocument[]> {
    return ApiKey.find({ userId: new mongoose.Types.ObjectId(userId) })
      .select('-keyHash')
      .sort({ createdAt: -1 });
  }

  /**
   * Revoke an active API key
   */
  async revokeApiKey(userId: string, keyId: string): Promise<boolean> {
    const res = await ApiKey.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(keyId),
        userId: new mongoose.Types.ObjectId(userId),
      },
      { status: 'revoked' }
    );
    return !!res;
  }

  /**
   * Validate raw API key from request headers
   */
  async validateApiKey(rawKey: string): Promise<{ userId: string } | null> {
    if (!rawKey || !rawKey.startsWith('vf_live_')) return null;

    const keyHash = crypto.createHash('sha256').update(rawKey.trim()).digest('hex');
    const record = await ApiKey.findOne({ keyHash, status: 'active' });

    if (!record) return null;

    // Async record usage timestamp
    record.lastUsedAt = new Date();
    await record.save();

    return { userId: record.userId.toString() };
  }
}

export const apiKeyService = new ApiKeyService();
