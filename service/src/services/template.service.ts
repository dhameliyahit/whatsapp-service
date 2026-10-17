import { MessageTemplate, IMessageTemplateDocument, TemplateCategory } from '../models/messageTemplate.model';

const DEFAULT_PRESET_TEMPLATES = [
  {
    name: 'Standard Verification Code',
    category: 'otp' as TemplateCategory,
    body: `*{{brand}} Verification Code*

Your code is: *{{code}}*

• Valid for {{minutes}} minutes.
• Do not share this code with anyone.

_If you didn't request this, you can safely ignore this message._`,
    variables: ['brand', 'code', 'minutes'],
    isPreset: true,
  },
  {
    name: 'Secure 2FA Login',
    category: 'security' as TemplateCategory,
    body: `🔒 *{{brand}} Security Alert*

We detected a login request for your account.

Your one-time authentication code is: *{{code}}*

⏱ Expires in {{minutes}} minutes.

_If you did not initiate this login, please secure your account immediately._`,
    variables: ['brand', 'code', 'minutes'],
    isPreset: true,
  },
  {
    name: 'Order Confirmation Code',
    category: 'notification' as TemplateCategory,
    body: `📦 *{{brand}} Order Verification*

Hello! Your order confirmation code is *{{code}}*.

Please provide this code to the delivery partner to confirm your package receipt.

Thank you for choosing {{brand}}!`,
    variables: ['brand', 'code'],
    isPreset: true,
  },
];

export class TemplateService {
  /**
   * Seed default presets if none exist
   */
  async seedPresetsIfEmpty(): Promise<void> {
    const count = await MessageTemplate.countDocuments({ isPreset: true });
    if (count === 0) {
      await MessageTemplate.insertMany(DEFAULT_PRESET_TEMPLATES);
    }
  }

  /**
   * Get all templates available to user (presets + user custom templates)
   */
  async getTemplates(userId: string): Promise<IMessageTemplateDocument[]> {
    await this.seedPresetsIfEmpty();
    return MessageTemplate.find({
      $or: [{ isPreset: true }, { userId }],
    }).sort({ isPreset: -1, createdAt: -1 });
  }

  /**
   * Create a new custom template
   */
  async createTemplate(
    userId: string,
    data: { name: string; body: string; category?: TemplateCategory }
  ): Promise<IMessageTemplateDocument> {
    // Extract variables in format {{variable_name}}
    const matches = data.body.match(/\{\{([a-zA-Z0-9_]+)\}\}/g) || [];
    const variables = Array.from(new Set(matches.map((m) => m.replace(/[\{\}]/g, '').trim())));

    const template = new MessageTemplate({
      userId,
      name: data.name.trim(),
      category: data.category || 'otp',
      body: data.body.trim(),
      variables,
      isPreset: false,
    });

    await template.save();
    return template;
  }

  /**
   * Delete custom template
   */
  async deleteTemplate(userId: string, templateId: string): Promise<boolean> {
    const res = await MessageTemplate.deleteOne({ _id: templateId, userId, isPreset: false });
    return (res.deletedCount || 0) > 0;
  }
}

export const templateService = new TemplateService();
