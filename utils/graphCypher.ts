import type { ChatOpenAI } from '@langchain/openai';
import type { CachedSchema, SchemaInfo } from '@/utils/neo4jSchemaService';
import { getSchemaCache, type SchemaCacheDocument } from '@/utils/schemaCache';
import neo4jClient from '@/utils/neo4jClient';

interface GenerateCypherParams {
  question: string;
  llm: ChatOpenAI;
  schemaDoc?: SchemaCacheDocument | null;
  maxPreviewRows?: number;
  domainHint?: string;
}

interface CypherGeneration {
  cypher: string;
  domain: string;
  summary: string;
  rows: Array<Record<string, any>>;
  rowCount: number;
  executionTimeMs: number;
}

const DEFAULT_PREVIEW_ROWS = 5;

export async function generateGraphAugmentation(
  params: GenerateCypherParams
): Promise<CypherGeneration | null> {
  const { question, llm, maxPreviewRows = DEFAULT_PREVIEW_ROWS, domainHint } = params;

  if (!question || !llm) {
    return null;
  }

  if (!neo4jClient.isAvailable()) {
    console.warn('[GRAPH-RAG] Neo4j not configured; skipping graph augmentation');
    return null;
  }

  const schemaDoc = params.schemaDoc ?? (await getSchemaCache());
  const schemaData = schemaDoc?.schema_data;

  if (!schemaData || !schemaData.schemas || Object.keys(schemaData.schemas).length === 0) {
    return null;
  }

  const domain = selectDomain(schemaData, domainHint);
  const domainSchema = schemaData.schemas[domain];

  if (!domainSchema) {
    console.warn(`[GRAPH-RAG] Domain "${domain}" not found in schema`);
    return null;
  }

  try {
    const prompt = buildCypherPrompt(question, domain, domainSchema);
    const response = await llm.invoke([
      {
        role: 'system',
        content:
          'You are an expert Neo4j Cypher author. Respond with precise Cypher that follows the provided schema.'
      },
      {
        role: 'user',
        content: prompt
      }
    ]);

    const textResponse = messageToString(response);
    const cypher = extractCypher(textResponse);

    if (!cypher) {
      console.warn('[GRAPH-RAG] Unable to extract Cypher from LLM response');
      return null;
    }

    const execution = await neo4jClient.executeCypher(cypher);

    const summary = summarizeGraphResults({
      domain,
      cypher,
      rows: execution.rows,
      maxPreviewRows
    });

    return {
      cypher,
      domain,
      summary,
      rows: execution.rows,
      rowCount: execution.rowCount,
      executionTimeMs: execution.executionTimeMs
    };
  } catch (error) {
    console.error('[GRAPH-RAG] Graph augmentation failed:', error);
    return null;
  }
}


function selectDomain(schema: CachedSchema, domainHint?: string): string {
  if (domainHint && domainHint in schema.schemas) {
    return domainHint;
  }

  const available = Object.keys(schema.schemas);
  if (available.includes('general')) {
    return 'general';
  }

  return available[0];
}

function buildCypherPrompt(question: string, domain: string, schema: SchemaInfo): string {
  const nodeLabels = schema.node_labels?.join(', ') || 'None';
  const relationshipTypes = schema.relationship_types?.join(', ') || 'None';
  const nodeProps = formatNodeProperties(schema.node_properties);
  const connectionPatterns = formatConnectionPatterns(schema.connection_map || {});

  return `You are an expert Cypher query generator for a Neo4j graph.

# AVAILABLE DATA SCHEMA (domain: ${domain.toUpperCase()})

## Node Labels
${nodeLabels}

## Relationship Types
${relationshipTypes}

## Node Properties
${nodeProps}

${connectionPatterns}

USER QUESTION: "${question}"

GUIDELINES:
- Only use properties and relationship types that exist in the schema above.
- Use the relationship patterns exactly as provided (WORKS_FOR, HAS_POSITION, etc.).
- Use DISTINCT in the RETURN clause to avoid duplicates.
- For text filtering, use case-insensitive matching, e.g., WHERE toLower(node.text) CONTAINS 'value'.
- For queries involving ordering (first/last), order by real date properties (e.g., EmploymentTerm.start_date).
- If the question only requires a single node type, you may return a single MATCH without relationships.
- Limit results to at most 25 rows.

RESPONSE FORMAT:
CYPHER_QUERY:
[Place Cypher query here on the following lines].`;
}

function formatNodeProperties(nodeProps: Record<string, string[]> = {}): string {
  const lines: string[] = [];
  Object.entries(nodeProps).forEach(([label, props]) => {
    if (props.length) {
      lines.push(`- ${label}: ${props.slice(0, 8).join(', ')}`);
    }
  });
  return lines.join('\n') || 'No property definitions available.';
}

function formatConnectionPatterns(
  connectionMap: Record<string, Record<string, Record<string, number>>>
): string {
  const lines: string[] = [];
  lines.push('## Connection Patterns');

  const patterns: string[] = [];
  Object.entries(connectionMap).forEach(([source, targets]) => {
    Object.entries(targets).forEach(([target, relationships]) => {
      Object.keys(relationships).forEach(relType => {
        patterns.push(`(source:${source})-[:${relType}]->(target:${target})`);
      });
    });
  });

  if (patterns.length === 0) {
    lines.push('No connection patterns defined.');
  } else {
    patterns.slice(0, 20).forEach(pattern => {
      lines.push(`- ${pattern}`);
    });
  }

  lines.push('');
  lines.push('Copy the valid patterns above and replace source/target with your variable names.');
  return lines.join('\n');
}

function messageToString(response: any): string {
  if (!response) return '';
  const content = (response.content ?? response.text ?? response.output_text) as any;

  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map(chunk => (typeof chunk === 'string' ? chunk : chunk?.text ?? chunk?.content ?? ''))
      .join('\n');
  }

  return String(content ?? '');
}

function extractCypher(text: string): string | null {
  if (!text) return null;

  const marker = 'CYPHER_QUERY:';
  const markerIndex = text.indexOf(marker);
  if (markerIndex === -1) {
    const codeMatch = text.match(/```(?:cypher)?\n([\s\S]*?)```/i);
    if (codeMatch) {
      return codeMatch[1].trim();
    }
    return null;
  }

  const remainder = text.slice(markerIndex + marker.length);
  const lines = remainder.split('\n');
  const collected: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('```')) break;
    collected.push(trimmed);
  }

  return collected.join('\n').trim() || null;
}


function summarizeGraphResults(params: {
  domain: string;
  cypher: string;
  rows: Array<Record<string, any>>;
  maxPreviewRows: number;
}): string {
  const { domain, cypher, rows, maxPreviewRows } = params;
  const lines: string[] = [];

  lines.push(`Graph Query Results (domain: ${domain})`);
  lines.push(`Cypher: ${cypher}`);
  lines.push(`Rows returned: ${rows.length}`);
  lines.push('');

  if (rows.length === 0) {
    lines.push('No matching nodes were found in the graph.');
    return lines.join('\n');
  }

  const preview = rows.slice(0, maxPreviewRows);
  preview.forEach((row, index) => {
    const formatted = Object.entries(row)
      .map(([key, value]) => `${key}: ${formatValue(value)}`)
      .join(', ');
    lines.push(`${index + 1}. ${formatted}`);
  });

  if (rows.length > maxPreviewRows) {
    lines.push('...');
    lines.push(`(+${rows.length - maxPreviewRows} additional rows)`);
  }

  return lines.join('\n');
}

function formatValue(value: any): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    return `[${value.slice(0, 3).map(formatValue).join(', ')}${value.length > 3 ? ', ...' : ''}]`;
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

