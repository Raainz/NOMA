/** App-wide API singleton: secure token storage + configurable base URL. */

import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { createApiClient, Tokens, TokenStore } from './client';

/**
 * Set EXPO_PUBLIC_API_URL (e.g. in .env) to your machine's LAN IP when testing on a physical phone:
 *   EXPO_PUBLIC_API_URL=http://192.168.1.20:8000
 * The Android emulator reaches the host through 10.0.2.2.
 */
export const API_URL: string =
  process.env.EXPO_PUBLIC_API_URL ?? (Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000');

const TOKENS_KEY = 'NOMA_AUTH_TOKENS_V1';

const secureTokenStore: TokenStore = {
  async load(): Promise<Tokens | null> {
    try {
      const raw = await SecureStore.getItemAsync(TOKENS_KEY);
      return raw ? (JSON.parse(raw) as Tokens) : null;
    } catch {
      return null;
    }
  },
  async save(tokens) {
    await SecureStore.setItemAsync(TOKENS_KEY, JSON.stringify(tokens));
  },
  async clear() {
    await SecureStore.deleteItemAsync(TOKENS_KEY).catch(() => undefined);
  },
};

export const api = createApiClient({ baseUrl: API_URL, tokenStore: secureTokenStore });
