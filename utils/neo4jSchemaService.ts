/**
 * Neo4j Schema Service for ChatFactoryTemplate
 * ===========================================
 *
 * Manages Neo4j schema data for intelligent Cypher query generation.
 * Integrates with the schema webhook to receive updates from the container.
 */

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

interface SchemaServiceStats {
  cache_hits: number;
  cache_misses: number;
  api_calls: number;
  last_update_time: number | null;
  schema_version: string | null;
  available_domains: string[];
}

class Neo4jSchemaService {
  private localCache: CachedSchema | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
  private readonly LOCALSTORAGE_KEY = 'neo4j_schema_cache';

  private stats: SchemaServiceStats = {
    cache_hits: 0,
    cache_misses: 0,
    api_calls: 0,
    last_update_time: null,
    schema_version: null,
    available_domains: []
  };

  constructor() {
    console.log('[SCHEMA-SERVICE] Neo4j Schema Service initialized');
    this.loadFromLocalStorage();
  }

  /**
   * Get schema data for Cypher generation
   */
  async getSchema(domain?: string): Promise<CachedSchema | null> {
    console.log(`[SCHEMA-SERVICE] Getting schema${domain ? ` for domain: ${domain}` : ''}`);

    // Check local cache first
    if (this.isCacheValid()) {
      this.stats.cache_hits++;
      console.log(`[SCHEMA-SERVICE] Cache hit - returning cached schema`);
      return this.localCache;
    }

    // Cache miss - try to fetch from API
    this.stats.cache_misses++;
    console.log(`[SCHEMA-SERVICE] Cache miss - fetching from webhook API`);

    try {
      const schema = await this.fetchSchemaFromAPI();
      if (schema) {
        this.updateCache(schema);
        return schema;
      }
    } catch (error) {
      console.error(`[SCHEMA-SERVICE] Failed to fetch schema from API: ${error}`);
    }

    // Return stale cache if available
    if (this.localCache) {
      console.log(`[SCHEMA-SERVICE] Returning stale cache as fallback`);
      return this.localCache;
    }

    console.log(`[SCHEMA-SERVICE] No schema available`);
    return null;
  }

  /**
   * Get schema for specific domain
   */
  async getDomainSchema(domain: string): Promise<SchemaInfo | null> {
    const fullSchema = await this.getSchema(domain);
    if (!fullSchema || !fullSchema.schemas[domain]) {
      return null;
    }
    return fullSchema.schemas[domain];
  }

  /**
   * Generate Cypher context string for LLM
   */
  async generateCypherContext(domain?: string, maxTokens: number = 1000): Promise<string> {
    const schema = await this.getSchema(domain);
    if (!schema) {
      return "Schema not available. Use MATCH (n) RETURN labels(n), keys(n) LIMIT 10 to explore.";
    }

    if (domain && schema.schemas[domain]) {
      return this.formatDomainContext(domain, schema.schemas[domain], maxTokens);
    } else {
      return this.formatGlobalContext(schema, maxTokens);
    }
  }

  /**
   * Get connection patterns for query generation
   */
  async getConnectionPatterns(domain?: string): Promise<string[]> {
    const schema = await this.getSchema(domain);
    if (!schema) {
      return [];
    }

    const patterns: string[] = [];
    const targetSchema = domain && schema.schemas[domain] ? schema.schemas[domain] : this.getFirstAvailableSchema(schema);

    if (targetSchema?.connection_map) {
      Object.entries(targetSchema.connection_map).forEach(([source, targets]) => {
        Object.entries(targets).forEach(([target, relationships]) => {
          Object.keys(relationships).forEach(relType => {
            patterns.push(`(${source})-[:${relType}]->(${target})`);
          });
        });
      });
    }

    return patterns;
  }

  /**
   * Get available node labels
   */
  async getNodeLabels(domain?: string): Promise<string[]> {
    const schema = await this.getSchema(domain);
    if (!schema) {
      return [];
    }

    const targetSchema = domain && schema.schemas[domain] ? schema.schemas[domain] : this.getFirstAvailableSchema(schema);
    return targetSchema?.node_labels || [];
  }

  /**
   * Get available relationship types
   */
  async getRelationshipTypes(domain?: string): Promise<string[]> {
    const schema = await this.getSchema(domain);
    if (!schema) {
      return [];
    }

    const targetSchema = domain && schema.schemas[domain] ? schema.schemas[domain] : this.getFirstAvailableSchema(schema);
    return targetSchema?.relationship_types || [];
  }

  /**
   * Get properties for a specific node type
   */
  async getNodeProperties(nodeLabel: string, domain?: string): Promise<string[]> {
    const schema = await this.getSchema(domain);
    if (!schema) {
      return [];
    }

    const targetSchema = domain && schema.schemas[domain] ? schema.schemas[domain] : this.getFirstAvailableSchema(schema);
    return targetSchema?.node_properties[nodeLabel] || [];
  }

  /**
   * Force refresh schema from webhook API
   */
  async refreshSchema(): Promise<boolean> {
    console.log(`[SCHEMA-SERVICE] Force refreshing schema...`);

    try {
      const schema = await this.fetchSchemaFromAPI();
      if (schema) {
        this.updateCache(schema);
        console.log(`[SCHEMA-SERVICE] Schema refreshed successfully`);
        return true;
      }
    } catch (error) {
      console.error(`[SCHEMA-SERVICE] Failed to refresh schema: ${error}`);
    }

    return false;
  }

  /**
   * Check if schema is available
   */
  isSchemaAvailable(): boolean {
    return this.localCache !== null;
  }

  /**
   * Get service statistics
   */
  getStats(): SchemaServiceStats {
    return { ...this.stats };
  }

  /**
   * Clear cache (for testing)
   */
  clearCache(): void {
    this.localCache = null;
    this.cacheTimestamp = 0;
    this.clearLocalStorage();
    console.log(`[SCHEMA-SERVICE] Cache cleared`);
  }

  // Private methods

  private isCacheValid(): boolean {
    if (!this.localCache) {
      return false;
    }

    const age = Date.now() - this.cacheTimestamp;
    return age < this.CACHE_TTL_MS;
  }

  private async fetchSchemaFromAPI(): Promise<CachedSchema | null> {
    this.stats.api_calls++;

    const response = await fetch('/api/schema-webhook', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Unknown API error');
    }

    // Extract schema from response (GET returns the full schema)
    const schema: CachedSchema = {
      schemas: data.schemas,
      global_stats: data.global_stats,
      cache_created: data.cache_created,
      last_refresh: data.last_refresh,
      version: data.version,
      total_nodes: data.total_nodes,
      total_relationships: data.total_relationships
    };

    return schema;
  }

  private updateCache(schema: CachedSchema): void {
    this.localCache = schema;
    this.cacheTimestamp = Date.now();
    this.stats.last_update_time = this.cacheTimestamp;
    this.stats.schema_version = schema.version;
    this.stats.available_domains = Object.keys(schema.schemas);

    this.saveToLocalStorage();
    console.log(`[SCHEMA-SERVICE] Cache updated with version: ${schema.version}`);
  }

  private loadFromLocalStorage(): void {
    if (typeof window === 'undefined') {
      return; // Server-side rendering
    }

    try {
      const cached = localStorage.getItem(this.LOCALSTORAGE_KEY);
      if (cached) {
        const data = JSON.parse(cached);
        const age = Date.now() - data.timestamp;

        if (age < this.CACHE_TTL_MS) {
          this.localCache = data.schema;
          this.cacheTimestamp = data.timestamp;
          this.stats.schema_version = data.version;
          this.stats.available_domains = Object.keys(data.schema.schemas || {});
          console.log(`[SCHEMA-SERVICE] Loaded schema from localStorage (age: ${Math.round(age / 1000)}s)`);
        } else {
          localStorage.removeItem(this.LOCALSTORAGE_KEY);
          console.log(`[SCHEMA-SERVICE] Removed stale schema from localStorage`);
        }
      }
    } catch (error) {
      console.warn(`[SCHEMA-SERVICE] Failed to load from localStorage: ${error}`);
    }
  }

  private saveToLocalStorage(): void {
    if (typeof window === 'undefined' || !this.localCache) {
      return;
    }

    try {
      const data = {
        schema: this.localCache,
        timestamp: this.cacheTimestamp,
        version: this.localCache.version
      };
      localStorage.setItem(this.LOCALSTORAGE_KEY, JSON.stringify(data));
      console.log(`[SCHEMA-SERVICE] Saved schema to localStorage`);
    } catch (error) {
      console.warn(`[SCHEMA-SERVICE] Failed to save to localStorage: ${error}`);
    }
  }

  private clearLocalStorage(): void {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      localStorage.removeItem(this.LOCALSTORAGE_KEY);
    } catch (error) {
      console.warn(`[SCHEMA-SERVICE] Failed to clear localStorage: ${error}`);
    }
  }

  private getFirstAvailableSchema(schema: CachedSchema): SchemaInfo | null {
    const domains = Object.keys(schema.schemas);
    if (domains.length === 0) {
      return null;
    }
    return schema.schemas[domains[0]];
  }

  private formatDomainContext(domain: string, schemaInfo: SchemaInfo, maxTokens: number): string {
    const lines = [
      `# Neo4j Schema for ${domain.toUpperCase()} Domain`,
      '',
      `## Node Labels (${schemaInfo.node_labels.length})`,
      schemaInfo.node_labels.slice(0, 10).join(', '),
      '',
      `## Relationship Types (${schemaInfo.relationship_types.length})`,
      schemaInfo.relationship_types.slice(0, 10).join(', '),
      '',
      '## Key Properties'
    ];

    // Add sample properties for key labels
    Object.entries(schemaInfo.node_properties).slice(0, 3).forEach(([label, props]) => {
      if (props.length > 0) {
        lines.push(`- ${label}: ${props.slice(0, 5).join(', ')}`);
      }
    });

    // Add connection patterns
    if (schemaInfo.connection_map) {
      lines.push('', '## Connection Patterns');
      const patterns = this.formatConnectionPatterns(schemaInfo.connection_map);
      lines.push(...patterns.slice(0, 10));
    }

    return lines.join('\n');
  }

  private formatGlobalContext(schema: CachedSchema, maxTokens: number): string {
    const lines = [
      `# Neo4j Graph Schema (${schema.total_nodes} nodes)`,
      ''
    ];

    Object.entries(schema.schemas).forEach(([domain, schemaInfo]) => {
      lines.push(`## ${domain.toUpperCase()} Domain`);
      lines.push(`Labels: ${schemaInfo.node_labels.slice(0, 5).join(', ')}`);
      lines.push(`Relationships: ${schemaInfo.relationship_types.slice(0, 5).join(', ')}`);
      lines.push('');
    });

    return lines.join('\n');
  }

  private formatConnectionPatterns(connectionMap: Record<string, Record<string, Record<string, number>>>): string[] {
    const patterns: string[] = [];

    Object.entries(connectionMap).forEach(([source, targets]) => {
      Object.entries(targets).forEach(([target, relationships]) => {
        Object.keys(relationships).forEach(relType => {
          patterns.push(`(${source})-[:${relType}]->(${target})`);
        });
      });
    });

    return patterns;
  }
}

// Export singleton instance
export const neo4jSchemaService = new Neo4jSchemaService();

// Export types for use in other files
export type { CachedSchema, SchemaInfo, SchemaServiceStats };

// Export utility functions
export async function getSchemaForCypher(domain?: string): Promise<string> {
  return await neo4jSchemaService.generateCypherContext(domain);
}

export async function getAvailableNodeLabels(domain?: string): Promise<string[]> {
  return await neo4jSchemaService.getNodeLabels(domain);
}

export async function getAvailableRelationshipTypes(domain?: string): Promise<string[]> {
  return await neo4jSchemaService.getRelationshipTypes(domain);
}

export async function getConnectionPatterns(domain?: string): Promise<string[]> {
  return await neo4jSchemaService.getConnectionPatterns(domain);
}

export function isSchemaAvailable(): boolean {
  return neo4jSchemaService.isSchemaAvailable();
}