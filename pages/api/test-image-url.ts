import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { imageUrl } = req.body;

  if (!imageUrl) {
    return res.status(400).json({ error: 'No image URL provided' });
  }

  try {
    console.log('Testing Firebase Storage URL:', imageUrl);
    
    // Test the URL with fetch
    const response = await fetch(imageUrl, {
      method: 'HEAD', // Just check if accessible
      headers: {
        'User-Agent': 'ChatFactory-Test/1.0'
      }
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    if (response.ok) {
      return res.status(200).json({ 
        success: true, 
        status: response.status,
        headers: Object.fromEntries(response.headers.entries())
      });
    } else {
      return res.status(200).json({ 
        success: false, 
        status: response.status,
        error: `HTTP ${response.status}`,
        headers: Object.fromEntries(response.headers.entries())
      });
    }

  } catch (error: any) {
    console.error('Error testing image URL:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message,
      type: error.constructor.name
    });
  }
}
