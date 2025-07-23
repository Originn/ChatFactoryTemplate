import React, { useState } from 'react';
import { Box, Button, Typography, Alert, LinearProgress } from '@mui/material';

interface TestImageEmbeddingProps {
  userEmail: string;
}

const TestImageEmbedding: React.FC<TestImageEmbeddingProps> = ({ userEmail }) => {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const testImageEmbedding = async () => {
    setTesting(true);
    setResult(null);
    setError(null);

    try {
      // Test with a sample image URL
      const testImageUrl = 'https://via.placeholder.com/300x200/0066CC/FFFFFF?text=Test+Image';
      
      const response = await fetch('/api/embed-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': userEmail
        },
        body: JSON.stringify({
          imageUrls: [testImageUrl],
          contextText: 'Test image for embedding functionality verification'
        })
      });

      const data = await response.json();

      if (data.success) {
        setResult(data);
      } else {
        setError(data.error || 'Unknown error occurred');
      }

    } catch (err: any) {
      setError(err.message || 'Network error occurred');
    } finally {
      setTesting(false);
    }
  };

  return (
    <Box sx={{ p: 3, border: '1px solid #ddd', borderRadius: 2, mb: 2 }}>
      <Typography variant="h6" gutterBottom>
        🧪 Test Image Embedding
      </Typography>
      
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Test the Jina multimodal embedding functionality with a sample image.
      </Typography>

      <Button 
        variant="contained" 
        onClick={testImageEmbedding}
        disabled={testing}
        sx={{ mb: 2 }}
      >
        {testing ? 'Testing...' : 'Test Image Embedding'}
      </Button>

      {testing && (
        <Box sx={{ mb: 2 }}>
          <LinearProgress />
          <Typography variant="caption" sx={{ mt: 1, display: 'block' }}>
            Generating embedding with Jina...
          </Typography>
        </Box>
      )}

      {result && (
        <Alert severity="success" sx={{ mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            ✅ Embedding Generated Successfully!
          </Typography>
          <Typography variant="body2">
            <strong>Embedding ID:</strong> {result.embedding_id}<br/>
            <strong>Dimensions:</strong> {result.details.embedding_dimensions}<br/>
            <strong>Timestamp:</strong> {result.details.timestamp}<br/>
            <strong>Namespace:</strong> {result.details.namespace}
          </Typography>
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            ❌ Test Failed
          </Typography>
          <Typography variant="body2">
            {error}
          </Typography>
        </Alert>
      )}

      <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
        <Typography variant="caption" color="text.secondary">
          <strong>Prerequisites:</strong><br/>
          • NEXT_PUBLIC_ENABLE_IMAGE_EMBEDDINGS=true<br/>
          • EMBEDDING_PROVIDER=jina<br/>
          • JINA_API_KEY configured<br/>
          • Pinecone index with 1024 dimensions
        </Typography>
      </Box>
    </Box>
  );
};

export default TestImageEmbedding;
