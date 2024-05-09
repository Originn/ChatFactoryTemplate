// QuestionEmbedder.ts
import { PineconeStore } from '@langchain/pinecone';
import { OpenAIEmbeddings } from '@langchain/openai';
import { Document } from '@langchain/core/documents';
import { waitForUserInput } from '@/utils/textsplitter';
import { insertQuestionEmbedderDetails } from '@/db';

const codePrefix = '8374-8924-7365-2734';

export class QuestionEmbedder {
  private vectorStore: PineconeStore;
  private embeddings: OpenAIEmbeddings;
  private userEmail: any;

  constructor(vectorStore: PineconeStore, embeddings: OpenAIEmbeddings, userEmail : any) {
    this.vectorStore = vectorStore;
    this.embeddings = embeddings;
    this.userEmail = userEmail;
  }

  async embedQuestion(sanitizedQuestion: string, userEmail : any): Promise<boolean> {
    if (sanitizedQuestion.startsWith(codePrefix)) {
      const questionToEmbed = sanitizedQuestion.slice(codePrefix.length).trim();
      const embedding = await this.embeddings.embedDocuments([questionToEmbed]);
      const document = new Document({
        pageContent: questionToEmbed,
        metadata: {
          file: 'user uploads',
          loc: {
            lines: {
              from: 0,
              to: 0,
            },
          },
          source: userEmail, // You can set the source URL here if available
          type: 'user_input', // Set the type to 'user_input' or any other appropriate value
        },
      });

      console.log('document to embed:', document);
      //await waitForUserInput();
      // Add the vector (embedding) to the Pinecone index
      await this.vectorStore.addVectors([embedding[0]], [document]);
      const timestamp = new Date().toISOString();
      await insertQuestionEmbedderDetails(questionToEmbed, timestamp, userEmail);
      return true; // Return true if the question was embedded
    }
    return false; // Return false if the question was not embedded
  }
}