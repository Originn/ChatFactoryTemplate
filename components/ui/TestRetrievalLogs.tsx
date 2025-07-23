import React, { useState } from 'react';
import { Box, Button, Typography, Alert, Paper, Chip } from '@mui/material';

interface TestRetrievalLogsProps {
  userEmail: string;
}

const TestRetrievalLogs: React.FC<TestRetrievalLogsProps> = ({ userEmail }) => {
  const [testing, setTesting] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const testQueries = [
    "How do I configure CAM settings?",
    "What is SolidCAM?", 
    "Show me API commands",
    "Toolpath configuration guide"
  ];

  const testRetrieval = async (query: string) => {
    setTesting(true);
    setLogs(prev => [...prev, `🧪 Testing query: "${query}"`]);

    try {
      const response = await fetch('/api/chat-stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': userEmail
        },
        body: JSON.stringify({
          question: query,
          roomId: 'test-retrieval-logs',
          history: []
        })
      });

      if (response.ok) {
        setLogs(prev => [...prev, `✅ Query completed - check console for retrieval logs`]);
      } else {
        setLogs(prev => [...prev, `❌ Query failed: ${response.status}`]);
      }

    } catch (error: any) {
      setLogs(prev => [...prev, `❌ Network error: ${error.message}`]);
    } finally {
      setTesting(false);
    }
  };

  const clearLogs = () => setLogs([]);

  return (
    <Box sx={{ p: 3, border: '1px solid #ddd', borderRadius: 2, mb: 2 }}>
      <Typography variant="h6" gutterBottom>
        🔍 Test Pinecone Retrieval Logs
      </Typography>
      
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Test different queries to see Pinecone embedding retrieval logs in the console.
        Open Browser DevTools Console to see detailed retrieval information.
      </Typography>

      <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {testQueries.map((query, index) => (
          <Button 
            key={index}
            variant="outlined" 
            size="small"
            onClick={() => testRetrieval(query)}
            disabled={testing}
          >
            Test: "{query.substring(0, 20)}..."
          </Button>
        ))}
      </Box>

      <Box sx={{ mb: 2, display: 'flex', gap: 1 }}>
        <Button 
          variant="contained" 
          color="primary"
          onClick={() => testRetrieval("Custom test query for embeddings")}
          disabled={testing}
        >
          {testing ? 'Testing...' : 'Run Test Query'}
        </Button>
        
        <Button 
          variant="outlined" 
          onClick={clearLogs}
        >
          Clear Logs
        </Button>
      </Box>

      {logs.length > 0 && (
        <Paper sx={{ p: 2, maxHeight: 300, overflow: 'auto', bgcolor: '#f5f5f5' }}>
          <Typography variant="subtitle2" gutterBottom>
            Test Activity Log:
          </Typography>
          {logs.map((log, index) => (
            <Typography 
              key={index} 
              variant="body2" 
              sx={{ 
                fontFamily: 'monospace', 
                fontSize: '0.75rem',
                mb: 0.5,
                color: log.includes('✅') ? 'success.main' : 
                       log.includes('❌') ? 'error.main' : 'text.primary'
              }}
            >
              {log}
            </Typography>
          ))}
        </Paper>
      )}

      <Alert severity="info" sx={{ mt: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          📝 What to Look For in Console:
        </Typography>
        <Box component="ul" sx={{ margin: 0, paddingLeft: 2 }}>
          <li><strong>🔍 [RETRIEVAL]</strong> - Query and search parameters</li>
          <li><strong>📄 [RETRIEVAL]</strong> - Documents found with previews</li>
          <li><strong>🤖 [RAG_RESPONSE]</strong> - Answer generation status</li>
          <li><strong>✅ [DOCUMENT_ADDED]</strong> - Final documents with scores</li>
          <li><strong>📊 [DOCUMENT_SUMMARY]</strong> - Results summary</li>
        </Box>
      </Alert>

      <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Chip label="🔍 Search Logs" size="small" color="primary" />
        <Chip label="📄 Document Results" size="small" color="secondary" />
        <Chip label="✅ Added Documents" size="small" color="success" />
        <Chip label="📊 Final Summary" size="small" color="info" />
      </Box>
    </Box>
  );
};

export default TestRetrievalLogs;
