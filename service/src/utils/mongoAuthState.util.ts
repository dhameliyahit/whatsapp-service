import {
  AuthenticationCreds,
  AuthenticationState,
  BufferJSON,
  initAuthCreds,
  SignalDataTypeMap,
} from '@whiskeysockets/baileys';
import { WhatsAppAuthKey } from '../models/whatsappAuthKey.model';

export interface MongoAuthStateResult {
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
  clearCreds: () => Promise<void>;
}

export const useMongoAuthState = async (sessionKey: string): Promise<MongoAuthStateResult> => {
  const writeData = async (keyId: string, data: any): Promise<void> => {
    try {
      const serialized = JSON.stringify(data, BufferJSON.replacer);
      await WhatsAppAuthKey.findOneAndUpdate(
        { sessionKey, keyId },
        { data: serialized },
        { upsert: true, new: true }
      );
    } catch (err) {
      console.error(`:-> [WhatsApp Auth] Error writing key ${keyId} for session ${sessionKey}:`, err);
    }
  };

  const readData = async (keyId: string): Promise<any> => {
    try {
      const doc = await WhatsAppAuthKey.findOne({ sessionKey, keyId });
      if (!doc || !doc.data) return null;
      return JSON.parse(doc.data, BufferJSON.reviver);
    } catch (err) {
      console.error(`:-> [WhatsApp Auth] Error reading key ${keyId} for session ${sessionKey}:`, err);
      return null;
    }
  };

  const removeData = async (keyId: string): Promise<void> => {
    try {
      await WhatsAppAuthKey.deleteOne({ sessionKey, keyId });
    } catch (err) {
      console.error(`:-> [WhatsApp Auth] Error removing key ${keyId} for session ${sessionKey}:`, err);
    }
  };

  // Load or initialize authentication credentials
  const credsData = await readData('creds');
  const creds: AuthenticationCreds = credsData || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async <T extends keyof SignalDataTypeMap>(type: T, ids: string[]): Promise<{ [key: string]: SignalDataTypeMap[T] }> => {
          const result: { [key: string]: SignalDataTypeMap[T] } = {};
          await Promise.all(
            ids.map(async (id) => {
              const keyId = `${type}-${id}`;
              const value = await readData(keyId);
              if (value) {
                result[id] = value;
              }
            })
          );
          return result;
        },
        set: async (data: any): Promise<void> => {
          const tasks: Promise<void>[] = [];
          for (const category in data) {
            for (const id in data[category]) {
              const value = data[category][id];
              const keyId = `${category}-${id}`;
              if (value) {
                tasks.push(writeData(keyId, value));
              } else {
                tasks.push(removeData(keyId));
              }
            }
          }
          await Promise.all(tasks);
        },
      },
    },
    saveCreds: async () => {
      await writeData('creds', creds);
    },
    clearCreds: async () => {
      await WhatsAppAuthKey.deleteMany({ sessionKey });
    },
  };
};
