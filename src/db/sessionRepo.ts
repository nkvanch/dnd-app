// ============================================================================
// FILE: src/db/sessionRepo.ts
// Device session singleton — one row, always id = 1.
//
// deviceId is generated once on first install and never changes.
// It is stored in expo-secure-store for tamper resistance and also
// mirrored in the device_session SQLite table for fast access.
// ============================================================================
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { DeviceSession } from '../engine/types';
import { getDb } from './db';

const SECURE_STORE_KEY = 'dnd_device_id';

type SessionRow = {
  id:         number;
  deviceId:   string;
  nickname:   string;
  role:       string;
  campaignId: string | null;
};

/** Generate a compact UUID-like string (no external deps). */
function generateDeviceId(): string {
  const hex = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0');
  return `${hex()}${hex()}-${hex()}-4${hex().slice(1)}-${hex()}-${hex()}${hex()}${hex()}`;
}

/**
 * Returns the existing DeviceSession, or creates a new one on first install.
 * deviceId is fetched from SecureStore first — if missing, one is generated,
 * stored in SecureStore, then persisted to SQLite.
 * On web, returns a transient in-memory session (no persistence).
 */
export async function getOrCreateSession(): Promise<DeviceSession> {
  if (Platform.OS === 'web') {
    return {
      deviceId:   generateDeviceId(),
      nickname:   '',
      role:       'player',
      campaignId: null,
    };
  }

  const db = getDb();

  // Check SQLite first (fast path after first boot)
  const existing = await db.getFirstAsync<SessionRow>(
    'SELECT * FROM device_session WHERE id = 1'
  );

  if (existing) {
    return {
      deviceId:   existing.deviceId,
      nickname:   existing.nickname,
      role:       (existing.role as 'dm' | 'player'),
      campaignId: existing.campaignId ?? null,
    };
  }

  // First install: look for a deviceId already in SecureStore
  // (handles reinstall scenarios where SQLite is wiped but SecureStore survives)
  let deviceId = await SecureStore.getItemAsync(SECURE_STORE_KEY);
  if (!deviceId) {
    deviceId = generateDeviceId();
    await SecureStore.setItemAsync(SECURE_STORE_KEY, deviceId);
  }

  const session: DeviceSession = {
    deviceId,
    nickname:   '',
    role:       'player',
    campaignId: null,
  };

  await db.runAsync(
    `INSERT INTO device_session (id, deviceId, nickname, role, campaignId)
     VALUES (1, ?, ?, ?, ?)`,
    [session.deviceId, session.nickname, session.role, session.campaignId]
  );

  return session;
}

/**
 * Persist partial DeviceSession updates.
 * Does not allow changing deviceId (immutable after creation).
 */
export async function updateSession(
  updates: Partial<Omit<DeviceSession, 'deviceId'>>
): Promise<void> {
  if (Platform.OS === 'web') return;
  const db = getDb();
  const fields: string[]  = [];
  const values: unknown[] = [];

  if (updates.nickname !== undefined)   { fields.push('nickname = ?');   values.push(updates.nickname); }
  if (updates.role !== undefined)       { fields.push('role = ?');       values.push(updates.role); }
  if ('campaignId' in updates)          { fields.push('campaignId = ?'); values.push(updates.campaignId ?? null); }

  if (fields.length === 0) return;
  values.push(1); // WHERE id = 1

  await db.runAsync(
    `UPDATE device_session SET ${fields.join(', ')} WHERE id = 1`,
    values as (string | number | null)[]
  );
}
