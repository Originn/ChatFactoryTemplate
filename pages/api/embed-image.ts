// pages/api/embed-image.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { getPinecone } from '@/utils/pinecone-client';
import { createJinaMultimodalEmbedding, createJinaImageOnlyEmbedding, isJinaProvider, getModelDimensions } from '@/utils/embeddingProviders';
import { PINECONE_NAME_SPACE } from '@/config/pinecone';
import { v4 as uuidv4 } from 'uuid';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userEmail = req.headers.authorization;
  if (!userEmail) {
    return res.status(401).json({ error: 'Unauthorized - user email required' });
  }

  // Validate Jina configuration
  if (!isJinaProvider()) {
    return res.status(400).json({ 
      error: 'Jina provider not configured. Set EMBEDDING_PROVIDER=jina in environment variables.' 
    });
  }

  if (!process.env.JINA_API_KEY) {
    return res.status(500).json({ error: 'JINA_API_KEY not configured' });
  }

  try {
    const { imageUrls, contextText } = req.body;

    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
      return res.status(400).json({ error: 'imageUrls array is required' });
    }

    if (imageUrls.length > 2) {
      return res.status(400).json({ error: 'Maximum 2 images allowed per embedding' });
    }

    console.log(`Generating Jina IMAGE-ONLY embedding for ${imageUrls.length} image(s)`);

    // Generate image-only embedding (ignoring text context)
    const embedding = await createJinaImageOnlyEmbedding(imageUrls);

    if (!embedding || embedding.length === 0) {
      throw new Error('No embedding generated');
    }

    console.log(`Generated IMAGE-ONLY embedding with ${embedding.length} dimensions`);

    // Prepare metadata (still store context text for reference but don't use in embedding)
    const timestamp = new Date().toISOString();
    const embeddingId = `user_image_${uuidv4()}`;
    const contextForMetadata = contextText || `User uploaded image(s) from chat interface at ${timestamp}`;

    const metadata = {
      // Core identification
      content_type: 'user_uploaded_image',
      user_email: userEmail,
      upload_timestamp: timestamp,
      embedding_id: embeddingId,
      
      // Image information
      image_count: imageUrls.length,
      image_urls: imageUrls,
      
      // Context information (stored but not used in embedding)
      context_text: contextForMetadata,
      embedding_type: 'image_only', // NEW: Indicate this is image-only
      source: 'chat_interface',
      
      // Technical information
      embedding_provider: 'jina',
      embedding_model: process.env.EMBEDDING_MODEL || 'jina-embeddings-v4',
      embedding_dimensions: getModelDimensions(),
      embedding_task: 'retrieval.query',
      
      // Flattened session information (no nested objects)
      user_agent: req.headers['user-agent'] || 'unknown',
      ip_address: req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown'
    };

    // Store in Pinecone
    const pinecone = getPinecone();
    const namespace = PINECONE_NAME_SPACE || 'default';
    
    await pinecone.namespace(namespace).upsert([{
      id: embeddingId,
      values: embedding,
      metadata: metadata
    }]);

    console.log(`Stored embedding in Pinecone with ID: ${embeddingId}`);

    // Return success response
    return res.status(200).json({
      success: true,
      embedding_id: embeddingId,
      message: 'Image-only embedding generated and stored successfully',
      details: {
        embedding_type: 'image_only',
        embedding_dimensions: embedding.length,
        image_count: imageUrls.length,
        context_text_stored: contextForMetadata,
        note: 'Text context stored for reference but not used in embedding',
        timestamp: timestamp,
        namespace: PINECONE_NAME_SPACE || 'default'
      }
    });

  } catch (error: any) {
    console.error('Error generating image embedding:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Failed to generate image-only embedding',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
