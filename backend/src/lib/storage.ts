import axios from 'axios';
import { childLogger } from './logger.js';
import { cacheGet, CACHE_TTL } from './cache.js';

const log = childLogger('storage');

/**
 * Object storage abstraction.
 * Currently supports: local filesystem + Supabase Storage.
 * For 5M+ users, swap to S3/R2/Cloudflare.
 */

export interface StorageConfig {
  /** 'local' | 'supabase' | 's3' */
  provider: 'local' | 'supabase' | 's3';
  /** For Supabase: bucket name */
  bucket?: string;
  /** For local: base directory */
  localDir?: string;
}

function getStorageConfig(): StorageConfig {
  const provider = (process.env.STORAGE_PROVIDER as any) || 'supabase';
  return {
    provider,
    bucket: process.env.STORAGE_BUCKET || 'papers',
    localDir: process.env.STORAGE_LOCAL_DIR || './storage',
  };
}

/**
 * Upload a file to object storage.
 */
export async function uploadFile(
  key: string,
  data: Buffer,
  contentType: string = 'application/octet-stream',
): Promise<string> {
  const config = getStorageConfig();

  switch (config.provider) {
    case 'supabase':
      return uploadToSupabase(key, data, contentType, config.bucket!);
    case 'local':
      return uploadToLocal(key, data, config.localDir!);
    case 's3':
      throw new Error('S3 storage not yet implemented — use supabase or local');
    default:
      throw new Error(`Unknown storage provider: ${config.provider}`);
  }
}

/**
 * Download a file from object storage (with caching).
 */
export async function downloadFile(key: string): Promise<Buffer | null> {
  const config = getStorageConfig();

  return cacheGet(
    `storage:${key}`,
    3600,
    async () => {
      switch (config.provider) {
        case 'supabase':
          return downloadFromSupabase(key, config.bucket!);
        case 'local':
          return downloadFromLocal(key, config.localDir!);
        default:
          return null;
      }
    },
  );
}

/**
 * Get a public URL for a file (if supported).
 */
export function getPublicUrl(key: string): string | null {
  const config = getStorageConfig();

  switch (config.provider) {
    case 'supabase': {
      const supabaseUrl = process.env.SUPABASE_URL;
      return `${supabaseUrl}/storage/v1/object/public/${config.bucket}/${key}`;
    }
    case 'local':
      return `/storage/${key}`;
    default:
      return null;
  }
}

/**
 * Delete a file from object storage.
 */
export async function deleteFile(key: string): Promise<void> {
  const config = getStorageConfig();

  switch (config.provider) {
    case 'supabase': {
      const { supabase } = await import('../db/supabase.js');
      await supabase.storage.from(config.bucket!).remove([key]);
      break;
    }
    case 'local': {
      const { unlinkSync } = await import('fs');
      const { join } = await import('path');
      try { unlinkSync(join(config.localDir!, key)); } catch { /* ignore */ }
      break;
    }
  }
}

// --- Supabase Storage ---

async function uploadToSupabase(
  key: string,
  data: Buffer,
  contentType: string,
  bucket: string,
): Promise<string> {
  const { supabase } = await import('../db/supabase.js');

  const { error } = await supabase.storage
    .from(bucket)
    .upload(key, data, {
      contentType,
      upsert: true,
    });

  if (error) {
    log.error({ key, err: error.message }, 'Supabase upload failed');
    throw new Error(`Upload failed: ${error.message}`);
  }

  const publicUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/${bucket}/${key}`;
  return publicUrl;
}

async function downloadFromSupabase(key: string, bucket: string): Promise<Buffer | null> {
  const { supabase } = await import('../db/supabase.js');

  const { data, error } = await supabase.storage.from(bucket).download(key);

  if (error || !data) {
    log.debug({ key }, 'Supabase download failed');
    return null;
  }

  return Buffer.from(await data.arrayBuffer());
}

// --- Local filesystem ---

import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';

async function uploadToLocal(key: string, data: Buffer, baseDir: string): Promise<string> {
  const filePath = join(baseDir, key);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, data);
  return `/storage/${key}`;
}

async function downloadFromLocal(key: string, baseDir: string): Promise<Buffer | null> {
  const filePath = join(baseDir, key);
  if (!existsSync(filePath)) return null;
  return readFileSync(filePath);
}
