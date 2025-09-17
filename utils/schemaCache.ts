import { adminDb } from '@/utils/firebaseAdmin';
import type { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { CachedSchema } from '@/utils/neo4jSchemaService';

export interface SchemaCacheMetadata {
  user_id?: string | null;
  neo4j_uri?: string | null;
  version_hash?: string | null;
  chatbot_id?: string | null;
  source?: string | null;
  updated_at?: FieldValue | Timestamp | null;
  has_schema?: boolean;
}

export interface SchemaCacheDocument {
  schema_data?: CachedSchema;
  metadata?: SchemaCacheMetadata;
}

const SCHEMA_CACHE_COLLECTION = 'schema_cache';
const SCHEMA_CACHE_DOCUMENT = 'current';
const CACHE_TTL_MS = 60_000; // 1 minute

let cachedSchemaDoc: SchemaCacheDocument | null = null;
let lastFetched = 0;

export async function getSchemaCache(force = false): Promise<SchemaCacheDocument | null> {
  const now = Date.now();
  if (!force && cachedSchemaDoc && now - lastFetched < CACHE_TTL_MS) {
    return cachedSchemaDoc;
  }

  try {
    const snapshot = await adminDb
      .collection(SCHEMA_CACHE_COLLECTION)
      .doc(SCHEMA_CACHE_DOCUMENT)
      .get();

    if (!snapshot.exists) {
      cachedSchemaDoc = null;
      lastFetched = now;
      return null;
    }

    const data = snapshot.data() as SchemaCacheDocument | undefined;
    cachedSchemaDoc = data || null;
    lastFetched = now;
    return cachedSchemaDoc;
  } catch (error) {
    console.error('[SCHEMA-CACHE] Failed to load schema cache:', error);
    return cachedSchemaDoc; // return last known cache (may be null)
  }
}

export function primeSchemaCache(doc: SchemaCacheDocument): void {
  cachedSchemaDoc = doc;
  lastFetched = Date.now();
}

