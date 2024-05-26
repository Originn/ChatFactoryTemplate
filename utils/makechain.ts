import { OpenAI, ChatOpenAI } from '@langchain/openai';
import { PineconeStore } from '@langchain/pinecone';
import { ConversationalRetrievalQAChain } from 'langchain/chains';
import { MyDocument } from 'utils/GCSLoader';
import { BufferMemory } from "langchain/memory";
import { BaseRetriever } from "@langchain/core/retrievers";
import { getIO } from "@/socketServer.cjs";
import { v4 as uuidv4 } from 'uuid';
import { insertQA } from '../db';
import { OpenAIEmbeddings } from '@langchain/openai';
import { HumanMessage } from "@langchain/core/messages";
import { MaxMarginalRelevanceSearchOptions } from "@langchain/core/vectorstores";
import { BaseRetrieverInterface } from '@langchain/core/retrievers';
import { RunnableConfig } from '@langchain/core/runnables';
// Type Definitions
type SearchResult = [MyDocument, number];

interface DocumentInterface<T> {
  pageContent: string;
  metadata: T;
}

// Utility Functions
async function detectLanguageWithOpenAI(text: string, nonStreamingModel: OpenAI): Promise<string> {
  const prompt = LANGUAGE_DETECTION_PROMPT.replace('{text}', text);
  const response = await nonStreamingModel.generate([prompt]);

  if (response.generations.length > 0 && response.generations[0].length > 0) {
    const firstGeneration = response.generations[0][0];
    return firstGeneration.text.trim();
  }

  return 'English';
}

async function filteredSimilaritySearch(vectorStore: any, queryVector: number[], type: string, limit: number, minScore: number): Promise<SearchResult[]> {
  try {
    const results: SearchResult[] = await vectorStore.similaritySearchVectorWithScore(queryVector, limit, { type: type });
    const filteredResults = results.filter(([document, score]: SearchResult) => score >= minScore);
    return filteredResults;
  } catch (error) {
    console.error("Error in filteredSimilaritySearch:", error);
    return [];
  }
}

async function translateToEnglish(question: string, translationModel: OpenAI): Promise<string> {
  const response = await translationModel.generate([TRANSLATION_PROMPT.replace('{question}', question)]);

  if (response.generations.length > 0 && response.generations[0].length > 0) {
    const firstGeneration = response.generations[0][0];
    const translatedText = firstGeneration.text.trim();
    return translatedText;
  }

  return 'Translation not available.';
}

// Class Definitions
class CustomRetriever extends BaseRetriever implements BaseRetrieverInterface<Record<string, any>> {
  lc_namespace = [];  // Confirm if this is being used or else consider removing it.

  constructor(private vectorStore: PineconeStore) {
    super();
  }

  async getRelevantDocuments(query: string, options?: Partial<RunnableConfig>): Promise<DocumentInterface<Record<string, any>>[]> {
    const { k, fetchK, lambda } = this.getMMRSettings();

    const mmrOptions: MaxMarginalRelevanceSearchOptions<any> = {
      k: k,
      fetchK: fetchK,
      lambda: lambda,
    };

    const results = await this.vectorStore.maxMarginalRelevanceSearch(query, mmrOptions);
    return results.map(doc => new MyDocument({
      ...doc,
      metadata: { ...doc.metadata }
    }));
  }

  async invoke(input: string, options?: Partial<RunnableConfig>): Promise<DocumentInterface<Record<string, any>>[]> {
    const documents = await this.getRelevantDocuments(input, options);
    return documents;
  }
  
  private getMMRSettings(): { k: number, fetchK: number, lambda: number } {
    return {
      k: this.getEnvironmentSetting('K_EMBEDDINGS', 6),
      fetchK: this.getEnvironmentSetting('FETCH_K_EMBEDDINGS', 12),
      lambda: parseFloat(process.env['LAMBDA_EMBEDDINGS'] || '0.2')
    };
  }

  private getEnvironmentSetting(variable: string, defaultValue: number): number {
    const value = Number(process.env[variable]);
    return isNaN(value) ? defaultValue : value;
  }

  async storeEmbeddings(query: string, minScoreSourcesThreshold: number) {
    const embedder = new OpenAIEmbeddings({ modelName: "text-embedding-3-small", dimensions: 1536 });
    const embeddingsResponse = await embedder.embedQuery(query);
    const pdfResults = await filteredSimilaritySearch(
      this.vectorStore, embeddingsResponse, 'pdf', 2, minScoreSourcesThreshold
    );
    const webinarResults = await filteredSimilaritySearch(
      this.vectorStore, embeddingsResponse, 'youtube', 2, minScoreSourcesThreshold
    );
    const sentinelResults = await filteredSimilaritySearch(
      this.vectorStore, embeddingsResponse, 'sentinel', 2, minScoreSourcesThreshold
    );

    const combinedResults = [...pdfResults, ...webinarResults, ...sentinelResults];

    combinedResults.sort((a, b) => b[1] - a[1]);

    return combinedResults;
  }
}

const io = getIO();
const roomMemories: Record<string, BufferMemory> = {};
const MODEL_NAME = process.env.MODEL_NAME;
const CONDENSE_PROMPT = `Given the history of the conversation and a follow up question, rephrase the follow up question to be a standalone question.
If the follow up question does not need context like when the follow up question is a remark like: excellent, thanks, thank you etc., return the exact same text back.
Rephrase the Standalone question also if replacing abbriviations to full strings.
abbriviations:
HSS - High Speed Surface
HSM - High Speed Machining
HSR - High Speed Roughing
gpp - general post processor

Chat History:
{chat_history}
Follow Up Input: {question}
Standalone question:`;

const QA_PROMPT = `You are a multilingual helpful and friendly assistant. You focus on helping SolidCAM users with their questions.

- When asked about a specific Service Pack (SP) release, like SolidCAM 2023 SP3, answer about this specific Service Pack (SP) release only! Don't include in your answer info about other Service Packs (e.g., don't include SolidCAM 2023 SP1 info in an answer about SP3).
- If a question is unrelated to SolidCAM, kindly inform the user that your assistance is focused on SolidCAM-related topics.
- If the user asks a question without marking the year answer the question regarding the latest SolidCAM 2023 release.
- Discuss iMachining only if the user specifically asks for it.
- Add links only if the link appear in the context. Also show all jpg images directly in the answer.
- If you do not have the information in the context to answer a question, admit it openly without fabricating responses.
- If the user's questions is valid and there is no documentation or context about it, let him know that he cam leave a comment and we will do our best to include it at a later stage.
Your responses should be tailored to the question's intent, using text formatting (bold with **, italic with __, strikethrough with ~~) to enhance clarity, and organized with headings, paragraphs, or lists as appropriate.
=========
context: {context}
=========
Question: {question}
Answer in the {language} language:`;

const TRANSLATION_PROMPT = `Translate the following text to English. Try to translate it taking into account that it's about SolidCAM. Return the translated question only:\nText: {question}`;
const LANGUAGE_DETECTION_PROMPT = `Detect the language of the following text and respond with the language name only, nothing else:\n\nText: "{text}"`;
const TEMPRATURE = parseFloat(process.env.TEMPRATURE || "0");

export const makeChain = (vectorstore: PineconeStore, onTokenStream: (token: string) => void, userEmail: string) => {
  const streamingModel = new ChatOpenAI({
    streaming: true,
    modelName: MODEL_NAME,
    temperature: TEMPRATURE,
    modelKwargs: {
      seed: 1,
    },
    callbacks: [
      {
        handleLLMNewToken: (token) => {
          onTokenStream(token); // Forward the streamed token to the front-end
        },
      },
    ],
  });

  const nonStreamingModel = new OpenAI({
    modelName: 'gpt-4o',
    temperature: TEMPRATURE
  });

  const translationModel = new OpenAI({
    modelName: 'gpt-4o',
    temperature: TEMPRATURE
  });

  function generateUniqueId(): string {
    return uuidv4();
  }

  return {
    call: async (question: string, Documents: MyDocument[], roomId: string, userEmail: string) => {
      const qaId = generateUniqueId();

      if (!roomMemories[roomId]) {
        roomMemories[roomId] = new BufferMemory({
          memoryKey: "chat_history",
          inputKey: "question",
          outputKey: "text",
        });
      }
      let chat_history = roomMemories[roomId];
      const language = await detectLanguageWithOpenAI(question, nonStreamingModel);

      if (language !== 'English' && language !== 'German') {
        question = await translateToEnglish(question, translationModel);
      }

      const formattedPrompt = QA_PROMPT.replace('{language}', language);

      if ((chat_history.chatHistory as any).messages.length === 0) {
        const initialHumanMessage = new HumanMessage({
          content: "Hi",
          name: "Human",
        });
        chat_history.chatHistory.addMessage(initialHumanMessage);
      }

      const customRetriever = new CustomRetriever(vectorstore);
      const chain = ConversationalRetrievalQAChain.fromLLM(
        streamingModel,
        customRetriever,
        {
          memory: chat_history,
          questionGeneratorChainOptions: {
            llm: nonStreamingModel,
          },
          qaTemplate: formattedPrompt,
          questionGeneratorTemplate: CONDENSE_PROMPT,
          returnSourceDocuments: true,
          verbose: false
        }
      );

      const responseText = (await (async () => {
        const response = await chain.invoke({
          question: question,
        });
        return {
          text: response.text,
          sourceDocuments: response.sourceDocuments
        };
      })());

      const minScoreSourcesThreshold = process.env.MINSCORESOURCESTHRESHOLD !== undefined ? parseFloat(process.env.MINSCORESOURCESTHRESHOLD) : 0.78;
      let embeddingsStore;
      if (language == 'English' || language == 'German') {
        embeddingsStore = await customRetriever.storeEmbeddings(responseText.text, minScoreSourcesThreshold);
        for (const [doc, score] of embeddingsStore) {
          const myDoc = new MyDocument({
            pageContent: doc.pageContent,
            metadata: {
              source: doc.metadata.source,
              type: doc.metadata.type,
              videoLink: doc.metadata.videoLink,
              file: doc.metadata.file,
              score: score,
              image: doc.metadata.image
            }
          });

          Documents.push(myDoc);
        }
      } else {
        embeddingsStore = await responseText.sourceDocuments;
        for (const doc of embeddingsStore) {
          const myDoc = new MyDocument({
            pageContent: doc.pageContent,
            metadata: {
              source: doc.metadata.source,
              type: doc.metadata.type,
              videoLink: doc.metadata.videoLink,
              file: doc.metadata.file,
              score: doc.metadata.score,
              image: doc.metadata.image
            }
          });

          Documents.push(myDoc);
        }
      }

      if (roomId) {
        io.to(roomId).emit(`fullResponse-${roomId}`, {
          roomId: roomId,
          sourceDocs: Documents,
          qaId: qaId
        });
      } else {
        io.emit("fullResponse", {
          sourceDocs: Documents,
          qaId: qaId
        });
      }

      await insertQA(question, responseText.text, responseText.sourceDocuments, Documents, qaId, roomId, userEmail);

      let totalScore = 0;
      let count = 0;
      if (Documents && Documents.length > 0) {
        for (let doc of Documents) {
          if (doc.metadata) {
            totalScore += doc.metadata.score || 0;
            count++;
          }
        }
        totalScore = count > 0 ? totalScore / count : 0;
      }

      return Documents;
    },
    vectorstore,
  };
};
