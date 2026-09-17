// src/io/__tests__/exportShare.test.ts
// First coverage for this file. Regression lock for audit finding
// EXPORT-1: exportHomebrewItem's txt/md/pdf switch had no case for
// 'condition' (only the 'pack' format's separate wrapAsHomebrewPack did) —
// exporting a homebrew condition as txt/md/pdf silently fell through the
// switch with no matching case and no error. Mocks expo-file-system/
// expo-sharing (native modules with no existing mock setup elsewhere in
// this suite) just enough to prove the write/share calls actually happen,
// not to verify their exact content.
const mockWriteAsStringAsync = jest.fn().mockResolvedValue(undefined);
const mockShareAsync = jest.fn().mockResolvedValue(undefined);
const mockIsAvailableAsync = jest.fn().mockResolvedValue(true);

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: '/cache/',
  EncodingType: { UTF8: 'utf8', Base64: 'base64' },
  writeAsStringAsync: (...args: unknown[]) => mockWriteAsStringAsync(...args),
}));
jest.mock('expo-sharing', () => ({
  isAvailableAsync: () => mockIsAvailableAsync(),
  shareAsync: (...args: unknown[]) => mockShareAsync(...args),
}));
jest.mock('expo-print', () => ({ printToFileAsync: jest.fn() }));

import { exportHomebrewItem } from '../exportShare';
import { Condition } from '../../engine/types';

function sampleCondition(): Condition {
  return {
    id: 'test_condition', name: 'Test Condition', description: 'A test condition.',
    features: [],
  };
}

describe('exportHomebrewItem — condition (EXPORT-1)', () => {
  // withTimeout (exportShare.ts) races the real share/write call against a
  // 60s setTimeout that's never cleared once the real call wins — harmless
  // in the app, but leaves a dangling real timer if this test doesn't fake
  // it, which Jest warns about as a leaked handle.
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('actually writes and shares a file for txt format, instead of silently no-opping', async () => {
    await exportHomebrewItem('condition', sampleCondition(), 'txt');
    expect(mockWriteAsStringAsync).toHaveBeenCalledTimes(1);
    expect(mockShareAsync).toHaveBeenCalledTimes(1);
  });

  it('actually writes and shares a file for md format', async () => {
    await exportHomebrewItem('condition', sampleCondition(), 'md');
    expect(mockWriteAsStringAsync).toHaveBeenCalledTimes(1);
    expect(mockShareAsync).toHaveBeenCalledTimes(1);
  });
});
