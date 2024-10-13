import { PineconeStore } from '@langchain/pinecone';
import { OpenAIEmbeddings } from '@langchain/openai';
import { insertQuestionEmbedderDetails } from '@/db';
import { Document } from 'langchain/document'; // Import Document

const codePrefix = 'embed-4831-embed-4831';

export class QuestionEmbedder {
  private vectorStore: PineconeStore;
  private embeddings: OpenAIEmbeddings;
  private userEmail: any;

  constructor(vectorStore: PineconeStore, embeddings: OpenAIEmbeddings, userEmail: any) {
    this.vectorStore = vectorStore;
    this.embeddings = embeddings;
    this.userEmail = userEmail;
  }

  async embedQuestion(sanitizedQuestion: string, userEmail: any): Promise<boolean> {
    if (!sanitizedQuestion.startsWith(codePrefix)) {
      console.error('Error: Question does not start with the required code prefix.');
      return false;
    }

    const questionBody = sanitizedQuestion.slice(codePrefix.length).trim();
    const headerIndex = questionBody.indexOf('header:');
    const textIndex = questionBody.indexOf(' text:');

    if (headerIndex === -1 || textIndex === -1 || textIndex <= headerIndex) {
      console.error('Error: Question format is incorrect. Expected format "header: [header] text: [text]".');
      return false;
    }

    const header = questionBody.substring(headerIndex + 'header:'.length, textIndex).trim();
    const text = questionBody.substring(textIndex + ' text:'.length).trim();

    // Construct the full content in the desired format
    const fullContent = `${header}\n\n---\n\n${text}\n`;

    // Create a single document with the full content
    const document = new Document({
      pageContent: fullContent,
      metadata: {
        file: header,
        loc: { lines: { from: 0, to: 0 } },
        source: userEmail,
        type: 'user_input',
      },
    });

    try {
      // Embed the document
      const embedding = await this.embeddings.embedDocuments([document.pageContent]);

      // Add the vector to the vector store
      await this.vectorStore.addVectors(embedding, [document]);

      const timestamp = new Date().toISOString();
      await insertQuestionEmbedderDetails(questionBody, timestamp, userEmail);
      return true;
    } catch (error) {
      console.error('Error during embedding or storing vectors:', error);
      return false;
    }
  }
}
