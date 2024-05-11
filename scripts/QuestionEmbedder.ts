// QuestionEmbedder.ts
import { PineconeStore } from '@langchain/pinecone';
import { OpenAIEmbeddings } from '@langchain/openai';
import { insertQuestionEmbedderDetails } from '@/db';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { waitForUserInput } from '@/utils/textsplitter';

const codePrefix = '8374-8924-7365-2734';

export class QuestionEmbedder {
  private vectorStore: PineconeStore;
  private embeddings: OpenAIEmbeddings;
  private userEmail: any;
  private textSplitter: RecursiveCharacterTextSplitter;

  constructor(vectorStore: PineconeStore, embeddings: OpenAIEmbeddings, userEmail: any) {
    this.vectorStore = vectorStore;
    this.embeddings = embeddings;
    this.userEmail = userEmail;
    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
      separators: ["\n\n", "\n", " ", ""] // Default separators
    });
  }

  async embedQuestion(sanitizedQuestion: string, userEmail: any): Promise<boolean> {
    if (!sanitizedQuestion.startsWith(codePrefix)) {
      //console.log('Error: Question does not start with the required code prefix.');
      return false;
    }

    // Extract the question part after the code prefix and split into header and text segments
    const questionBody = sanitizedQuestion.slice(codePrefix.length).trim();
    const headerIndex = questionBody.indexOf('header:');
    const textIndex = questionBody.indexOf(' text:');

    if (headerIndex === -1 || textIndex === -1 || textIndex <= headerIndex) {
      //console.log('Error: Question format is incorrect. Expected format "header: [header] text: [text]".');
      return false;
    }

    const header = questionBody.substring(headerIndex + 'header:'.length, textIndex).trim();
    const text = questionBody.substring(textIndex + ' text:'.length).trim();

    // Use the splitter to divide the question into chunks with headers
    const documentChunks = await this.textSplitter.createDocuments([text], [{
      file: 'user uploads',
      loc: { lines: { from: 0, to: 0 } },
      source: userEmail,
      type: 'user_input',
    }], {
      chunkHeader: `${header}\n\n---\n\n`, // Use the extracted header for each chunk
      appendChunkOverlapHeader: true
    });

    // Log each chunk with metadata
    // console.log('Split into chunks with headers:');
    // documentChunks.forEach((doc, index) => {
    //   console.log(`Chunk ${index + 1}:`, doc.pageContent);
    //   console.log(`Metadata for Chunk ${index + 1}:`, doc.metadata);
    // });

    // Wait for user input before proceeding
    //await waitForUserInput();

    // Embed each document chunk
    const embeddingsPromises = documentChunks.map(doc => this.embeddings.embedDocuments([doc.pageContent]));
    const embeddings = await Promise.all(embeddingsPromises);

    // Add vectors to the Pinecone store
    const addVectorsPromises = embeddings.map((embedding, index) => 
      this.vectorStore.addVectors(embedding, [documentChunks[index]])
    );
    await Promise.all(addVectorsPromises);

    const timestamp = new Date().toISOString();
    await insertQuestionEmbedderDetails(questionBody, timestamp, userEmail);
    //console.log('All chunks embedded successfully.');
    return true;
  }
}
