// ============================================
// Supabase Storage Layer
// Drop-in replacement for the old localStorage mock.
// Maintains the same export interface to minimize changes in consumers.
// ============================================

import { supabase } from './supabase';
import type { Session, User as SupabaseUser, AuthChangeEvent } from '@supabase/supabase-js';

// ============================================
// ENUMS & TYPES
// ============================================
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface StorageErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

// ============================================
// TIMESTAMP COMPATIBILITY
// Supabase uses ISO strings. This class provides
// a compatible interface with the old Firestore Timestamp.
// ============================================
export class Timestamp {
  seconds: number;
  nanoseconds: number;

  constructor(seconds: number, nanoseconds: number) {
    this.seconds = seconds;
    this.nanoseconds = nanoseconds;
  }

  static now() {
    const now = Date.now();
    return new Timestamp(Math.floor(now / 1000), 0);
  }

  static fromDate(date: Date) {
    return new Timestamp(Math.floor(date.getTime() / 1000), 0);
  }

  toDate() {
    return new Date(this.seconds * 1000);
  }

  toMillis() {
    return this.seconds * 1000;
  }

  toISOString() {
    return this.toDate().toISOString();
  }
}

// ============================================
// HELPER: Convert snake_case DB rows to camelCase JS objects
// ============================================
const snakeToCamelMap: Record<string, string> = {
  user_id: 'userId',
  account_id: 'accountId',
  photo_url: 'photoURL',
  vorix_score: 'vorixScore',
  is_paid: 'isPaid',
  fixed_salary_amount: 'fixedSalaryAmount',
  fixed_salary_day: 'fixedSalaryDay',
  created_at: 'createdAt',
  updated_at: 'updatedAt',
  trial_ends_at: 'trialEndsAt',
  subscription_status: 'subscriptionStatus',
  coupon_used: 'couponUsed',
  trial_report_used: 'trialReportUsed',
  ai_requests_count: 'aiRequestsCount',
  last_ai_request_date: 'lastAiRequestDate',
  vorix_reward_claimed: 'vorixRewardClaimed',
  notification_settings: 'notificationSettings',
  completed_at: 'completedAt',
  unlocked_at: 'unlockedAt',
  balance_start_date: 'balanceStartDate',
  last_balance_check: 'lastBalanceCheck',
  long_description: 'longDescription',
  is_custom: 'isCustom',
  birth_date: 'birthDate',
  phone: 'phone',
  whatsapp_connected: 'whatsappConnected',
  whatsapp_number: 'whatsappNumber',
};

const camelToSnakeMap: Record<string, string> = Object.fromEntries(
  Object.entries(snakeToCamelMap).map(([k, v]) => [v, k])
);

function rowToCamel(row: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(row)) {
    const camelKey = snakeToCamelMap[key] || key;
    // Convert date strings to Timestamp-like objects for backward compat
    if (value && typeof value === 'string' && isISODate(value) && isDateField(key)) {
      const d = new Date(value);
      result[camelKey] = Timestamp.fromDate(d);
    } else {
      result[camelKey] = value;
    }
  }
  return result;
}

function camelToSnake(data: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    const snakeKey = camelToSnakeMap[key] || key;
    // Convert Timestamp objects to ISO strings for DB
    if (value instanceof Timestamp) {
      result[snakeKey] = value.toISOString();
    } else if (value instanceof Date) {
      result[snakeKey] = value.toISOString();
    } else {
      result[snakeKey] = value;
    }
  }
  return result;
}

function isISODate(str: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T/.test(str);
}

const DATE_FIELDS = new Set([
  'created_at', 'updated_at', 'trial_ends_at', 'completed_at',
  'unlocked_at', 'balance_start_date', 'last_balance_check', 'date',
]);

function isDateField(key: string): boolean {
  return DATE_FIELDS.has(key);
}

// ============================================
// PATH PARSING
// Firestore-like paths: "users/{uid}" or "users/{uid}/accounts"
// ============================================
interface PathInfo {
  table: string;
  userId?: string;
  docId?: string;
}

function parsePath(pathOrSegments: string | string[]): PathInfo {
  const segments = typeof pathOrSegments === 'string'
    ? pathOrSegments.split('/')
    : pathOrSegments;

  // "users" / uid
  if (segments.length === 2 && segments[0] === 'users') {
    return { table: 'users', docId: segments[1] };
  }

  // "users" / uid / "subcollection"
  if (segments.length === 3 && segments[0] === 'users') {
    return { table: segments[2], userId: segments[1] };
  }

  // "users" / uid / "subcollection" / docId
  if (segments.length === 4 && segments[0] === 'users') {
    return { table: segments[2], userId: segments[1], docId: segments[3] };
  }

  // Fallback: treat as table name
  return { table: segments.join('/') };
}

// ============================================
// AUTH WRAPPER
// Wraps Supabase Auth to match the old MockAuth interface.
// ============================================
class SupabaseAuthWrapper {
  currentUser: { uid: string; email: string | undefined; displayName: string | undefined; emailVerified: boolean } | null = null;
  private listeners: ((user: any) => void)[] = [];
  private initialized = false;

  constructor() {
    // Initialize from current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        this.currentUser = this._mapUser(session.user);
      }
      this.initialized = true;
      this.listeners.forEach(l => l(this.currentUser));
    });

    // Listen for auth changes
    supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      if (session?.user) {
        this.currentUser = this._mapUser(session.user);
      } else {
        this.currentUser = null;
      }
      this.listeners.forEach(l => l(this.currentUser));
    });
  }

  private _mapUser(user: SupabaseUser) {
    return {
      uid: user.id,
      email: user.email,
      displayName: user.user_metadata?.display_name || user.user_metadata?.username || 'Usuário Vorix',
      emailVerified: !!user.email_confirmed_at,
    };
  }

  onAuthStateChanged(callback: (user: any) => void) {
    this.listeners.push(callback);
    // If already initialized, fire immediately
    if (this.initialized) {
      setTimeout(() => callback(this.currentUser), 0);
    }
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  async signInWithEmailAndPassword(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw { code: mapSupabaseAuthError(error.message), message: error.message };
    if (data.user) {
      this.currentUser = this._mapUser(data.user);
    }
    return { user: this.currentUser };
  }

  async createUserWithEmailAndPassword(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw { code: mapSupabaseAuthError(error.message), message: error.message };

    // If email confirmation is enabled, Supabase won't create a session automatically.
    // In that case, attempt immediate sign in so the user doesn't need to confirm first.
    if (data.user && !data.session) {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (!signInError && signInData.user) {
        this.currentUser = this._mapUser(signInData.user);
        this.listeners.forEach(l => l(this.currentUser));
        return { user: this.currentUser };
      }
    }

    if (data.user) {
      this.currentUser = this._mapUser(data.user);
    }
    return { user: this.currentUser };
  }

  async signOut() {
    await supabase.auth.signOut();
    this.currentUser = null;
  }

  async updateProfile(data: { displayName?: string; photoURL?: string }) {
    const metadata: Record<string, any> = {};
    if (data.displayName !== undefined) metadata.display_name = data.displayName;
    if (data.photoURL !== undefined) metadata.photo_url = data.photoURL;

    await supabase.auth.updateUser({ data: metadata });
    if (this.currentUser && data.displayName) {
      this.currentUser.displayName = data.displayName;
    }
  }

  async updateEmail(email: string) {
    const { error } = await supabase.auth.updateUser({ email });
    if (error) throw { code: 'auth/requires-recent-login', message: error.message };
    if (this.currentUser) {
      this.currentUser.email = email;
    }
  }

  async updatePassword(newPassword?: string) {
    if (!newPassword) return;
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw { code: 'auth/requires-recent-login', message: error.message };
  }

  async sendPasswordResetEmail(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw { code: 'auth/user-not-found', message: error.message };
  }
}

function mapSupabaseAuthError(msg: string): string {
  const lower = msg.toLowerCase();
  if (lower.includes('invalid login')) return 'auth/wrong-password';
  if (lower.includes('user not found')) return 'auth/user-not-found';
  if (lower.includes('already registered') || lower.includes('already in use')) return 'auth/email-already-in-use';
  if (lower.includes('password') && lower.includes('short')) return 'auth/weak-password';
  if (lower.includes('invalid email') || lower.includes('valid email')) return 'auth/invalid-email';
  return 'auth/unknown';
}

// ============================================
// EXPORTS — Auth
// ============================================
export const auth = new SupabaseAuthWrapper();

export const onAuthStateChanged = (authInstance: SupabaseAuthWrapper, callback: (user: any) => void) =>
  authInstance.onAuthStateChanged(callback);

export const signInWithEmailAndPassword = (authInstance: SupabaseAuthWrapper, email: string, password?: string) =>
  authInstance.signInWithEmailAndPassword(email, password || '');

export const createUserWithEmailAndPassword = (authInstance: SupabaseAuthWrapper, email: string, password?: string) =>
  authInstance.createUserWithEmailAndPassword(email, password || '');

export const signOut = (authInstance: SupabaseAuthWrapper) => authInstance.signOut();

export const updateProfile = (user: any, data: any) => auth.updateProfile(data);

export const updateEmail = (user: any, email: string) => auth.updateEmail(email);

export const updatePassword = (user: any, password?: string) => auth.updatePassword(password);

export const sendPasswordResetEmail = (authInstance: SupabaseAuthWrapper, email: string) =>
  authInstance.sendPasswordResetEmail(email);

// ============================================
// EXPORTS — Database reference helpers
// ============================================
export const db = {};

export const collection = (_db: any, ...pathSegments: string[]) => pathSegments.join('/');
export const doc = (_db: any, ...pathSegments: string[]) => pathSegments.join('/');

// ============================================
// EXPORTS — CRUD Operations
// ============================================
export const getDoc = async (docPath: string) => {
  const info = parsePath(docPath);
  let query = supabase.from(info.table).select('*');

  if (info.table === 'users' && info.docId) {
    query = query.eq('id', info.docId);
  } else if (info.docId) {
    query = query.eq('id', info.docId);
    if (info.userId) {
      query = query.eq('user_id', info.userId);
    }
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    console.error('getDoc error:', error);
    return { exists: () => false, data: () => null, id: info.docId };
  }

  return {
    exists: () => data !== null,
    data: () => data ? rowToCamel(data) : null,
    id: data?.id || info.docId,
  };
};

export const getDocs = async (collPath: string) => {
  const info = parsePath(collPath);

  // Guard: skip query if userId is undefined or invalid
  if (info.userId && (info.userId === 'undefined' || info.userId.length < 10)) {
    return { docs: [], empty: true };
  }

  let query = supabase.from(info.table).select('*');

  if (info.userId) {
    query = query.eq('user_id', info.userId);
  }

  const { data, error } = await query;
  if (error) {
    console.error('getDocs error:', error);
    return { docs: [], empty: true };
  }

  const docs = (data || []).map((row: any) => ({
    id: row.id,
    data: () => rowToCamel(row),
  }));

  return { docs, empty: docs.length === 0 };
};

export const setDoc = async (docPath: string, data: any) => {
  const info = parsePath(docPath);
  const snakeData = camelToSnake(data);

  // Remove 'id' from data if it's the path-level ID
  delete snakeData.id;

  if (info.table === 'users') {
    // Valid columns in the users table — filter out any extra fields (e.g., 'uid' alias)
    const USERS_COLUMNS = new Set([
      'username', 'email', 'photo_url', 'vorix_score', 'is_paid',
      'fixed_salary_amount', 'fixed_salary_day', 'created_at', 'trial_ends_at',
      'subscription_status', 'coupon_used', 'trial_report_used', 'ai_requests_count',
      'last_ai_request_date', 'vorix_reward_claimed', 'notification_settings',
      'birth_date', 'phone', 'whatsapp_connected', 'whatsapp_number',
    ]);
    const filteredData: Record<string, any> = {};
    for (const [k, v] of Object.entries(snakeData)) {
      if (USERS_COLUMNS.has(k)) filteredData[k] = v;
    }
    const { error } = await supabase.from('users').upsert({
      id: info.docId,
      ...filteredData,
    });
    if (error) throw error;
  } else {
    // For subcollection docs
    if (info.docId) {
      // Try update first, then insert
      const { data: existing } = await supabase
        .from(info.table)
        .select('id')
        .eq('id', info.docId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from(info.table)
          .update(snakeData)
          .eq('id', info.docId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from(info.table)
          .insert({
            id: info.docId,
            user_id: info.userId,
            ...snakeData,
          });
        if (error) throw error;
      }
    }
  }
};

export const addDoc = async (collPath: string, data: any) => {
  const info = parsePath(collPath);

  // Guard: don't insert if userId is missing
  if (!info.userId || info.userId === 'undefined' || info.userId.length < 10) {
    throw new Error(`addDoc blocked: invalid user_id for table '${info.table}'`);
  }

  const snakeData = camelToSnake(data);
  delete snakeData.id; // Let DB generate UUID

  // Add user_id if this is a user-scoped collection
  if (info.userId) {
    snakeData.user_id = info.userId;
  }

  const { data: inserted, error } = await supabase
    .from(info.table)
    .insert(snakeData)
    .select('id')
    .single();

  if (error) throw error;
  return { id: inserted.id };
};

export const updateDoc = async (docPath: string, data: any) => {
  const info = parsePath(docPath);

  // Guard: don't update if docId is missing
  if (!info.docId || info.docId === 'undefined' || info.docId.length < 10) {
    console.warn(`updateDoc blocked: invalid docId for table '${info.table}'`);
    return;
  }

  const snakeData = camelToSnake(data);
  delete snakeData.id;

  // For users table, filter to only valid columns
  let finalData = snakeData;
  if (info.table === 'users') {
    const USERS_COLUMNS = new Set([
      'username', 'email', 'photo_url', 'vorix_score', 'is_paid',
      'fixed_salary_amount', 'fixed_salary_day', 'created_at', 'trial_ends_at',
      'subscription_status', 'coupon_used', 'trial_report_used', 'ai_requests_count',
      'last_ai_request_date', 'vorix_reward_claimed', 'notification_settings',
      'birth_date', 'phone', 'whatsapp_connected', 'whatsapp_number',
    ]);
    finalData = {};
    for (const [k, v] of Object.entries(snakeData)) {
      if (USERS_COLUMNS.has(k)) finalData[k] = v;
    }
  }

  let query = supabase.from(info.table).update(finalData);

  if (info.docId) {
    query = query.eq('id', info.docId);
  }

  const { error } = await query;
  if (error) throw error;
};

export const deleteDoc = async (docPath: string) => {
  const info = parsePath(docPath);

  if (!info.docId) {
    console.error('deleteDoc: no docId in path', docPath);
    return;
  }

  const { error } = await supabase
    .from(info.table)
    .delete()
    .eq('id', info.docId);

  if (error) throw error;
};

// ============================================
// EXPORTS — Realtime Subscriptions (onSnapshot)
// ============================================
export const onSnapshot = (
  path: any,
  callback: (snap: any) => void,
  errorCallback?: (err: any) => void
) => {
  const info = parsePath(path);
  const segments = typeof path === 'string' ? path.split('/') : path;
  const isDocument = segments.length % 2 === 0;

  // Guard: don't query if required IDs are missing/undefined
  const isValidUUID = (val: any) =>
    val && typeof val === 'string' && val !== 'undefined' && val.length > 10;

  if (isDocument && !isValidUUID(info.docId)) {
    // Return empty snapshot and a no-op unsubscribe
    setTimeout(() => callback({ exists: () => false, data: () => null, id: undefined }), 0);
    return () => {};
  }
  if (!isDocument && !isValidUUID(info.userId) && info.table !== 'users') {
    setTimeout(() => callback({ docs: [], empty: true }), 0);
    return () => {};
  }

  // Initial fetch
  const fetchData = async () => {
    try {
      if (isDocument) {
        // Single document
        let query = supabase.from(info.table).select('*');
        if (info.table === 'users' && info.docId) {
          query = query.eq('id', info.docId);
        } else if (info.docId) {
          query = query.eq('id', info.docId);
        }

        const { data, error } = await query.maybeSingle();
        if (error) throw error;

        callback({
          exists: () => data !== null,
          data: () => data ? rowToCamel(data) : null,
          id: data?.id || info.docId,
        });
      } else {
        // Collection
        let query = supabase.from(info.table).select('*');
        if (info.userId) {
          query = query.eq('user_id', info.userId);
        }

        const { data, error } = await query;
        if (error) throw error;

        const docs = (data || []).map((row: any) => ({
          id: row.id,
          data: () => rowToCamel(row),
        }));

        callback({ docs, empty: docs.length === 0 });
      }
    } catch (err) {
      console.error('onSnapshot fetch error:', err);
      if (errorCallback) errorCallback(err);
    }
  };

  // Initial load
  fetchData();

  // Subscribe to realtime changes
  const filter = info.userId ? `user_id=eq.${info.userId}` : undefined;
  const channelName = `realtime_${info.table}_${info.userId || info.docId || 'all'}_${Math.random().toString(36).slice(2, 8)}`;

  const channelConfig: any = {
    event: '*',
    schema: 'public',
    table: info.table,
  };
  if (filter) {
    channelConfig.filter = filter;
  } else if (isDocument && info.docId) {
    channelConfig.filter = `id=eq.${info.docId}`;
  }

  const channel = supabase
    .channel(channelName)
    .on('postgres_changes', channelConfig, () => {
      // Re-fetch on any change
      fetchData();
    })
    .subscribe();

  // Return unsubscribe function
  return () => {
    supabase.removeChannel(channel);
  };
};

// ============================================
// EXPORTS — Query helpers (compatibility stubs)
// ============================================
export const query = (path: string, ..._args: any[]) => path;
export const where = (..._args: any[]) => ({});
export const orderBy = (..._args: any[]) => ({});
export const limit = (..._args: any[]) => ({});
export const getDocFromServer = getDoc;

// ============================================
// EXPORTS — Error handling
// ============================================
export function handleStorageError(error: unknown, operationType: OperationType, path: string | null) {
  console.error('Supabase Storage Error:', error, operationType, path);
}

// ============================================
// EXPORTS — Storage Functions
// ============================================
export const uploadAvatar = async (userId: string, file: File): Promise<string> => {
  const fileExt = file.name.split('.').pop();
  const filePath = `${userId}/avatar-${Math.random().toString(36).substring(2)}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filePath, file);

  if (uploadError) throw uploadError;

  const { data: { publicUrl } } = supabase.storage
    .from('avatars')
    .getPublicUrl(filePath);

  return publicUrl;
};

// ============================================
// EXPORTS — Firebase compat stubs
// ============================================
export const initializeApp = () => ({});
export const getAuth = () => auth;
export const getFirestore = () => db;
