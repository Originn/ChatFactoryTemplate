import neo4j, { Driver, Session, Result } from 'neo4j-driver';

interface Neo4jConfig {
  uri: string;
  username: string;
  password: string;
  database?: string;
}

interface CypherExecutionResult {
  rows: Array<Record<string, any>>;
  rowCount: number;
  executionTimeMs: number;
}

class Neo4jClient {
  private driver: Driver | null = null;
  private config: Neo4jConfig | null = null;

  constructor() {
    this.initializeFromEnvironment();
  }

  private initializeFromEnvironment(): void {
    const uri = process.env.NEO4J_URI;
    const username = process.env.NEO4J_USERNAME;
    const password = process.env.NEO4J_PASSWORD;
    const database = process.env.NEO4J_DATABASE || 'neo4j';

    if (!uri || !username || !password) {
      console.warn('Neo4j environment variables not configured. Graph augmentation will be disabled.');
      return;
    }

    this.config = {
      uri,
      username,
      password,
      database
    };

    try {
      this.driver = neo4j.driver(
        uri,
        neo4j.auth.basic(username, password),
        {
          maxConnectionPoolSize: 50,
          maxTransactionRetryTime: 30000,
          connectionTimeout: 20000,
          maxConnectionLifetime: 60000 * 60, // 1 hour
        }
      );
      console.log('✅ Neo4j driver initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Neo4j driver:', error);
      this.driver = null;
      this.config = null;
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.driver || !this.config) {
      return false;
    }

    let session: Session | null = null;
    try {
      session = this.driver.session({ database: this.config.database });
      const result = await session.run('RETURN 1 as test');
      const testValue = result.records[0]?.get('test');

      if (testValue === 1) {
        console.log('✅ Neo4j connection test successful');
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ Neo4j connection test failed:', error);
      return false;
    } finally {
      if (session) {
        await session.close();
      }
    }
  }

  async executeCypher(cypher: string, params: Record<string, any> = {}): Promise<CypherExecutionResult> {
    if (!this.driver || !this.config) {
      throw new Error('Neo4j driver not initialized. Check environment variables: NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD');
    }

    let session: Session | null = null;
    const startTime = Date.now();

    try {
      session = this.driver.session({ database: this.config.database });
      const result = await session.run(cypher, params);

      const rows = result.records.map((record: any) => {
        const obj: Record<string, any> = {};
        record.keys.forEach((key: string) => {
          const value = record.get(key);
          // Handle Neo4j types conversion
          obj[key] = this.convertNeo4jValue(value);
        });
        return obj;
      });

      const executionTimeMs = Date.now() - startTime;

      return {
        rows,
        rowCount: rows.length,
        executionTimeMs
      };
    } catch (error) {
      console.error('❌ Cypher execution failed:', error);
      throw new Error(`Cypher execution failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      if (session) {
        await session.close();
      }
    }
  }

  private convertNeo4jValue(value: any): any {
    if (value === null || value === undefined) {
      return null;
    }

    // Handle Neo4j Integer type
    if (neo4j.isInt(value)) {
      return value.toNumber();
    }

    // Handle Neo4j Date/DateTime types
    if (neo4j.isDate(value) || neo4j.isDateTime(value) || neo4j.isTime(value)) {
      return value.toString();
    }

    // Handle Neo4j Node type
    if (value && typeof value === 'object' && 'labels' in value && 'properties' in value) {
      return {
        id: neo4j.isInt(value.identity) ? value.identity.toNumber() : value.identity,
        labels: value.labels,
        properties: this.convertProperties(value.properties)
      };
    }

    // Handle Neo4j Relationship type
    if (value && typeof value === 'object' && 'type' in value && 'properties' in value) {
      return {
        id: neo4j.isInt(value.identity) ? value.identity.toNumber() : value.identity,
        type: value.type,
        startNodeId: neo4j.isInt(value.start) ? value.start.toNumber() : value.start,
        endNodeId: neo4j.isInt(value.end) ? value.end.toNumber() : value.end,
        properties: this.convertProperties(value.properties)
      };
    }

    // Handle arrays
    if (Array.isArray(value)) {
      return value.map(item => this.convertNeo4jValue(item));
    }

    // Handle objects (properties)
    if (value && typeof value === 'object') {
      return this.convertProperties(value);
    }

    return value;
  }

  private convertProperties(properties: Record<string, any>): Record<string, any> {
    const converted: Record<string, any> = {};
    for (const [key, value] of Object.entries(properties)) {
      converted[key] = this.convertNeo4jValue(value);
    }
    return converted;
  }

  async close(): Promise<void> {
    if (this.driver) {
      await this.driver.close();
      this.driver = null;
      console.log('✅ Neo4j driver closed');
    }
  }

  isAvailable(): boolean {
    return this.driver !== null && this.config !== null;
  }

  getConfig(): Neo4jConfig | null {
    return this.config;
  }
}

// Singleton instance
const neo4jClient = new Neo4jClient();

export default neo4jClient;
export { Neo4jClient, type Neo4jConfig, type CypherExecutionResult };