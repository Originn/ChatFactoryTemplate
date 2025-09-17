/**
 * Schema Webhook Receiver for ChatFactoryTemplate
 * ==============================================
 *
 * Receives Neo4j schema updates from the langextract container
 * and caches them locally for immediate use in Cypher query generation.
 *
 * This endpoint is called by the container after graph building completes
 * for a specific user, ensuring the chatbot has the latest schema.
 */

import type { NextApiRequest, NextApiResponse } from 'next';

// Schema data structures (matching langextract_project format)
interface SchemaInfo {
  domain: string;
  node_labels: string[];
  relationship_types: string[];
  node_properties: Record<string, string[]>;
  relationship_properties: Record<string, string[]>;
  connection_map: Record<string, Record<string, Record<string, number>>>;
  last_updated: string;
  version_hash: string;
  constraints?: string[];
  indexes?: string[];
}

interface CachedSchema {
  schemas: Record<string, SchemaInfo>;
  global_stats: {
    total_nodes: number;
    total_relationships: number;
    total_labels: number;
    total_relationship_types: number;
    last_updated: string;
  };
  cache_created: string;
  last_refresh: string;
  version: string;
  total_nodes: number;
  total_relationships: number;
}

interface WebhookPayload {
  schema_data: CachedSchema;
  user_id?: string;
  neo4j_uri: string;
  timestamp: string;
  version_hash: string;
  source: string;
}

interface WebhookResponse {
  success: boolean;
  message: string;
  timestamp: string;
  schema_version?: string;
  cached_domains?: string[];
  error?: string;
}

// In-memory schema cache for this chatbot instance
let schemaCache: CachedSchema | null = null;
let schemaCacheTimestamp: number = 0;

// Environment configuration
const WEBHOOK_AUTH_TOKEN = process.env.WEBHOOK_AUTH_TOKEN || 'default-dev-token';
const MAX_CACHE_AGE_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Main webhook handler
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<WebhookResponse>
): Promise<void> {
  const requestTime = new Date().toISOString();

  console.log(`🔔 [WEBHOOK] Schema webhook called: ${req.method} ${requestTime}`);

  // Handle CORS for container requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'POST') {
    await handleSchemaUpdate(req, res, requestTime);
  } else if (req.method === 'GET') {
    await handleSchemaRetrieval(req, res, requestTime);
  } else {
    res.status(405).json({
      success: false,
      message: `Method ${req.method} not allowed`,
      timestamp: requestTime,
      error: 'Only POST and GET methods are supported'
    });
  }
}

/**
 * Handle schema update from container (POST)
 */
async function handleSchemaUpdate(
  req: NextApiRequest,
  res: NextApiResponse<WebhookResponse>,
  requestTime: string
): Promise<void> {
  try {
    console.log(`📥 [WEBHOOK] Processing schema update...`);

    // Validate authentication
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log(`❌ [WEBHOOK] Missing or invalid authorization header`);
      res.status(401).json({
        success: false,
        message: 'Missing or invalid authorization header',
        timestamp: requestTime,
        error: 'Authorization header must be: Bearer <token>'
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer '
    if (token !== WEBHOOK_AUTH_TOKEN) {
      console.log(`❌ [WEBHOOK] Invalid authentication token`);
      res.status(401).json({
        success: false,
        message: 'Invalid authentication token',
        timestamp: requestTime,
        error: 'Token does not match expected value'
      });
      return;
    }

    // Validate payload
    const payload: WebhookPayload = req.body;
    if (!payload || !payload.schema_data) {
      console.log(`❌ [WEBHOOK] Invalid payload: missing schema_data`);
      res.status(400).json({
        success: false,
        message: 'Invalid payload: missing schema_data',
        timestamp: requestTime,
        error: 'Request body must contain schema_data field'
      });
      return;
    }

    // Validate schema data structure
    const schemaData = payload.schema_data;
    if (!schemaData.schemas || typeof schemaData.schemas !== 'object') {
      console.log(`❌ [WEBHOOK] Invalid schema data: missing or invalid schemas field`);
      res.status(400).json({
        success: false,
        message: 'Invalid schema data: missing or invalid schemas field',
        timestamp: requestTime,
        error: 'schema_data.schemas must be an object'
      });
      return;
    }

    // Log incoming schema update
    const domains = Object.keys(schemaData.schemas);
    console.log(`📊 [WEBHOOK] Schema update details:`);
    console.log(`   👤 User: ${payload.user_id || 'unknown'}`);
    console.log(`   🗄️ Neo4j: ${payload.neo4j_uri || 'unknown'}`);
    console.log(`   📊 Domains: ${domains.join(', ')}`);
    console.log(`   🔗 Total nodes: ${schemaData.total_nodes}`);
    console.log(`   🔗 Total relationships: ${schemaData.total_relationships}`);
    console.log(`   🔄 Version: ${payload.version_hash}`);

    // Cache the schema
    schemaCache = schemaData;
    schemaCacheTimestamp = Date.now();

    console.log(`✅ [WEBHOOK] Schema cached successfully in memory`);

    // Try to persist to localStorage if running in browser context
    // Note: This is for client-side caching when the API is called from frontend
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const cacheData = {
          schema: schemaData,
          timestamp: schemaCacheTimestamp,
          version: payload.version_hash
        };
        window.localStorage.setItem('neo4j_schema_cache', JSON.stringify(cacheData));
        console.log(`💾 [WEBHOOK] Schema also cached in localStorage`);
      } catch (localStorageError) {
        console.log(`⚠️ [WEBHOOK] Failed to cache in localStorage: ${localStorageError}`);
      }
    }

    // Success response
    res.status(200).json({
      success: true,
      message: 'Schema updated successfully',
      timestamp: requestTime,
      schema_version: payload.version_hash,
      cached_domains: domains
    });

  } catch (error) {
    console.error(`💥 [WEBHOOK] Error processing schema update: ${error}`);
    res.status(500).json({
      success: false,
      message: 'Internal server error processing schema update',
      timestamp: requestTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Handle schema retrieval (GET) - for internal chatbot use
 */
async function handleSchemaRetrieval(
  req: NextApiRequest,
  res: NextApiResponse<WebhookResponse>,
  requestTime: string
): Promise<void> {
  try {
    console.log(`📤 [WEBHOOK] Schema retrieval requested`);

    // Check if we have cached schema
    if (!schemaCache) {
      console.log(`❌ [WEBHOOK] No schema cache available`);
      res.status(404).json({
        success: false,
        message: 'No schema cache available',
        timestamp: requestTime,
        error: 'Schema has not been received from container yet'
      });
      return;
    }

    // Check cache age
    const cacheAge = Date.now() - schemaCacheTimestamp;
    if (cacheAge > MAX_CACHE_AGE_MS) {
      console.log(`⚠️ [WEBHOOK] Schema cache is stale (${Math.round(cacheAge / 1000 / 60)} minutes old)`);
      res.status(202).json({
        success: true,
        message: 'Schema cache is stale but returned anyway',
        timestamp: requestTime,
        schema_version: schemaCache.version,
        cached_domains: Object.keys(schemaCache.schemas)
      });
      return;
    }

    // Return cached schema
    const domains = Object.keys(schemaCache.schemas);
    console.log(`✅ [WEBHOOK] Returning cached schema:`);
    console.log(`   📊 Domains: ${domains.join(', ')}`);
    console.log(`   🔗 Total nodes: ${schemaCache.total_nodes}`);
    console.log(`   ⏰ Cache age: ${Math.round(cacheAge / 1000)} seconds`);

    // For GET requests, we return the actual schema data
    res.status(200).json({
      success: true,
      message: 'Schema retrieved successfully',
      timestamp: requestTime,
      schema_version: schemaCache.version,
      cached_domains: domains,
      // Include the actual schema data for GET requests
      ...(schemaCache as any)
    });

  } catch (error) {
    console.error(`💥 [WEBHOOK] Error retrieving schema: ${error}`);
    res.status(500).json({
      success: false,
      message: 'Internal server error retrieving schema',
      timestamp: requestTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Utility function to get current schema cache (for internal use)
 */
export function getCurrentSchemaCache(): CachedSchema | null {
  // Check if cache exists and is not too old
  if (schemaCache && (Date.now() - schemaCacheTimestamp) < MAX_CACHE_AGE_MS) {
    return schemaCache;
  }
  return null;
}

/**
 * Utility function to check if schema cache is available
 */
export function isSchemaCacheAvailable(): boolean {
  return schemaCache !== null && (Date.now() - schemaCacheTimestamp) < MAX_CACHE_AGE_MS;
}

/**
 * Utility function to get schema cache stats
 */
export function getSchemaCacheStats(): {
  available: boolean;
  age_seconds: number;
  version: string | null;
  domains: string[];
  total_nodes: number;
  total_relationships: number;
} {
  if (!schemaCache) {
    return {
      available: false,
      age_seconds: 0,
      version: null,
      domains: [],
      total_nodes: 0,
      total_relationships: 0
    };
  }

  const ageSeconds = Math.round((Date.now() - schemaCacheTimestamp) / 1000);

  return {
    available: ageSeconds < (MAX_CACHE_AGE_MS / 1000),
    age_seconds: ageSeconds,
    version: schemaCache.version,
    domains: Object.keys(schemaCache.schemas),
    total_nodes: schemaCache.total_nodes,
    total_relationships: schemaCache.total_relationships
  };
}