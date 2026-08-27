/**
 * Device Fingerprinting & IMEI Identifier Utility for Anti-Multi-Account Protection
 * Generates deterministic hardware and persistent client-side device identifiers.
 */

export interface DeviceInfo {
  deviceId: string;
  imei: string;
  fingerprint: string;
  platform: string;
  screenResolution: string;
  language: string;
  timezone: string;
}

const STORAGE_KEY = 'seka_device_imei_fingerprint';
const REGISTERED_FLAG_KEY = 'seka_device_has_registered';

/**
 * Generate a simple hash from a string
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Generate a pseudo-IMEI representation (15 numeric digits like standard cellular IMEI)
 */
function generatePseudoImei(seedString: string): string {
  let hashNum = 0;
  for (let i = 0; i < seedString.length; i++) {
    hashNum = (hashNum * 31 + seedString.charCodeAt(i)) % 1000000000000000;
  }
  const padded = hashNum.toString().padStart(14, '7').slice(0, 14);
  // Luhn check digit calculation
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    let digit = parseInt(padded[i], 10);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return `${padded}${checkDigit}`;
}

/**
 * Retrieve or generate unique device hardware fingerprint & IMEI
 */
export const getDeviceFingerprint = (): DeviceInfo => {
  let persistentId = '';
  try {
    persistentId = localStorage.getItem(STORAGE_KEY) || '';
  } catch (e) {
    console.warn('LocalStorage access warning:', e);
  }

  const screenRes = typeof window !== 'undefined' && window.screen
    ? `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`
    : '1920x1080x24';
  
  const platform = typeof navigator !== 'undefined' ? navigator.platform || 'WebPlatform' : 'Web';
  const language = typeof navigator !== 'undefined' ? navigator.language || 'az-AZ' : 'az';
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent || 'WebBrowser' : 'Browser';
  const timezone = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'Asia/Baku';
  const hardwareConcurrency = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;

  const rawSeed = `${userAgent}|${screenRes}|${language}|${timezone}|${platform}|${hardwareConcurrency}`;
  const rawHash = hashString(rawSeed);

  if (!persistentId) {
    persistentId = `DEV-${rawHash}-${Date.now().toString(36)}`;
    try {
      localStorage.setItem(STORAGE_KEY, persistentId);
    } catch (e) {}
  }

  const imei = generatePseudoImei(`${rawSeed}|${persistentId}`);
  const deviceId = `DEV_${rawHash}_${imei.slice(-6)}`;

  return {
    deviceId,
    imei,
    fingerprint: persistentId,
    platform,
    screenResolution: screenRes,
    language,
    timezone,
  };
};

/**
 * Mark device as registered locally in browser storage
 */
export const markDeviceAsLocallyRegistered = (username: string) => {
  try {
    localStorage.setItem(REGISTERED_FLAG_KEY, JSON.stringify({
      username,
      timestamp: Date.now(),
    }));
  } catch (e) {}
};

/**
 * Check if current browser instance was already marked as registered
 */
export const isDeviceLocallyRegistered = (): { isRegistered: boolean; username?: string } => {
  try {
    const raw = localStorage.getItem(REGISTERED_FLAG_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      return { isRegistered: true, username: data.username };
    }
  } catch (e) {}
  return { isRegistered: false };
};
