// services/chatbotBucketService.ts
// Service for managing chatbot-specific Firebase Storage buckets with granular service account permissions

import { Storage } from '@google-cloud/storage';

interface BucketConfig {
  documents: string;
  privateImages: string;
  documentImages: string;
}

interface SignedUrlOptions {
  action?: 'read' | 'write';
  expires?: number; // timestamp
  contentType?: string;
}

class ChatbotBucketService {
  private storage: Storage;
  private buckets: BucketConfig;

  constructor() {
    // Initialize storage with chatbot's specific service account
    this.storage = new Storage({
      projectId: process.env.FIREBASE_PROJECT_ID,
      credentials: {
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
    });

    // Get chatbot-specific bucket names from environment
    this.buckets = {
      documents: process.env.GCLOUD_STORAGE_BUCKET || '',
      privateImages: process.env.GCLOUD_PRIVATE_STORAGE_BUCKET || '', 
      documentImages: process.env.GCLOUD_DOCUMENT_IMAGES_BUCKET || '',
    };

    // Validate bucket configuration
    this.validateBucketConfig();
  }

  private validateBucketConfig(): void {
    const missing = Object.entries(this.buckets)
      .filter(([key, value]) => !value)
      .map(([key]) => key);

    if (missing.length > 0) {
      console.warn('Missing bucket configuration for:', missing.join(', '));
    }
  }

  /**
   * Get bucket instance for documents
   */
  getDocumentsBucket() {
    return this.storage.bucket(this.buckets.documents);
  }

  /**
   * Get bucket instance for private images 
   */
  getPrivateImagesBucket() {
    return this.storage.bucket(this.buckets.privateImages);
  }

  /**
   * Get bucket instance for document images (public)
   */
  getDocumentImagesBucket() {
    return this.storage.bucket(this.buckets.documentImages);
  }

  /**
   * Upload file to documents bucket
   */
  async uploadDocument(fileName: string, fileBuffer: Buffer, metadata?: any): Promise<string> {
    try {
      const bucket = this.getDocumentsBucket();
      const file = bucket.file(fileName);
      
      await file.save(fileBuffer, {
        metadata: {
          contentType: metadata?.contentType,
          ...metadata
        }
      });

      return `gs://${this.buckets.documents}/${fileName}`;
    } catch (error) {
      console.error('Failed to upload document:', error);
      throw error;
    }
  }

  /**
   * Upload file to private images bucket  
   */
  async uploadPrivateImage(userId: string, fileName: string, fileBuffer: Buffer, metadata?: any): Promise<string> {
    try {
      const bucket = this.getPrivateImagesBucket();
      const filePath = `${userId}/${fileName}`;
      const file = bucket.file(filePath);
      
      await file.save(fileBuffer, {
        metadata: {
          contentType: metadata?.contentType,
          userId: userId,
          uploadedAt: new Date().toISOString(),
          ...metadata
        }
      });

      return `gs://${this.buckets.privateImages}/${filePath}`;
      
    } catch (error: any) {
      console.error('Failed to upload private image:', error.message);
      throw error;
    }
  }

  /**
   * Upload file to public document images bucket
   */
  async uploadDocumentImage(fileName: string, fileBuffer: Buffer, metadata?: any): Promise<string> {
    try {
      const bucket = this.getDocumentImagesBucket();
      const file = bucket.file(fileName);
      
      await file.save(fileBuffer, {
        metadata: {
          contentType: metadata?.contentType,
          isPublic: 'true',
          ...metadata
        }
      });

      return `gs://${this.buckets.documentImages}/${fileName}`;
    } catch (error) {
      console.error('Failed to upload document image:', error);
      throw error;
    }
  }

  /**
   * Generate signed URL for private file access
   */
  async getSignedUrl(
    bucketType: 'documents' | 'privateImages' | 'documentImages',
    fileName: string,
    options: SignedUrlOptions = {}
  ): Promise<string> {
    try {
      const bucketName = this.buckets[bucketType];
      const bucket = this.storage.bucket(bucketName);
      const file = bucket.file(fileName);

      const signedUrlOptions = {
        version: 'v4' as const,
        action: options.action || 'read' as const,
        expires: options.expires || Date.now() + (15 * 60 * 1000), // 15 minutes default
        ...(options.contentType && { contentType: options.contentType })
      };

      const [signedUrl] = await file.getSignedUrl(signedUrlOptions);
      return signedUrl;
    } catch (error: any) {
      console.error(`Failed to generate signed URL for ${fileName}:`, error.message);
      throw error;
    }
  }

  /**
   * Get public URL for document images (no signing needed)
   */
  getPublicDocumentImageUrl(fileName: string): string {
    return `https://storage.googleapis.com/${this.buckets.documentImages}/${fileName}`;
  }

  /**
   * Delete file from any bucket
   */
  async deleteFile(
    bucketType: 'documents' | 'privateImages' | 'documentImages',
    fileName: string
  ): Promise<void> {
    try {
      const bucketName = this.buckets[bucketType];
      const bucket = this.storage.bucket(bucketName);
      const file = bucket.file(fileName);

      await file.delete();
    } catch (error) {
      console.error(`Failed to delete file ${fileName}:`, error);
      throw error;
    }
  }

  /**
   * List files in a bucket
   */
  async listFiles(
    bucketType: 'documents' | 'privateImages' | 'documentImages',
    prefix?: string
  ): Promise<string[]> {
    try {
      const bucketName = this.buckets[bucketType];
      const bucket = this.storage.bucket(bucketName);
      
      const [files] = await bucket.getFiles({
        prefix: prefix
      });

      return files.map(file => file.name);
    } catch (error) {
      console.error(`Failed to list files in ${bucketType}:`, error);
      throw error;
    }
  }

  /**
   * Check if file exists in bucket (graceful handling of permission issues)
   */
  async fileExists(
    bucketType: 'documents' | 'privateImages' | 'documentImages',
    fileName: string
  ): Promise<boolean> {
    try {
      const bucketName = this.buckets[bucketType];
      const bucket = this.storage.bucket(bucketName);
      const file = bucket.file(fileName);

      const [exists] = await file.exists();
      return exists;
    } catch (error: any) {
      // If we get a permission error, assume file might exist
      if (error.code === 403 || error.message?.includes('permission')) {
        return true; // Conservative assumption
      }
      
      return false;
    }
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(
    bucketType: 'documents' | 'privateImages' | 'documentImages',
    fileName: string
  ): Promise<any> {
    try {
      const bucketName = this.buckets[bucketType];
      const bucket = this.storage.bucket(bucketName);
      const file = bucket.file(fileName);

      const [metadata] = await file.getMetadata();
      return metadata;
    } catch (error) {
      console.error(`Failed to get file metadata ${fileName}:`, error);
      throw error;
    }
  }

  /**
   * Get bucket configuration info
   */
  getBucketConfig(): BucketConfig {
    return { ...this.buckets };
  }
}

// Export singleton instance
export default new ChatbotBucketService();
export { ChatbotBucketService };
