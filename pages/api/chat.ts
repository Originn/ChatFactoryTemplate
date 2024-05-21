// pages/api/chat.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { OpenAIEmbeddings } from '@langchain/openai';
import { PineconeStore } from '@langchain/pinecone';
import { makeChain } from '@/utils/makechain';
import { getPinecone } from '@/utils/pinecone-client';
import { PINECONE_NAME_SPACE } from '@/config/pinecone';
import { getIO } from "@/socketServer.cjs";
import { QuestionEmbedder } from "@/scripts/QuestionEmbedder";

interface RoomSession {
  stage: number;
  header?: string;
  text?: string;
}

const roomSessions: { [key: string]: RoomSession } = {};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { question, roomId, userEmail } = req.body;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!question) {
    return res.status(400).json({ message: 'No question in the request' });
  }

  if (!roomId) {
    return res.status(400).json({ message: 'No roomId in the request' });
  }

  const sanitizedQuestion = question.trim().replaceAll('\n', ' ');
  const codePrefix = 'embed-4831-embed-4831';
  const io = getIO();

  try {
    let session = roomSessions[roomId];

    if (sanitizedQuestion.startsWith(codePrefix)) {
      session = { stage: 1 };
      roomSessions[roomId] = session;
    }

    if (session) {
      if (session.stage === 1) {
        const message = 'You have entered the internal embedding mode for SolidCAM ChatBot. Please provide a header for the content and include a link if relevant.';
        roomSessions[roomId] = { ...session, stage: 2 };
        io.to(roomId).emit("newToken", message);
        return res.status(200).json({ message });

      } else if (session.stage === 2) {
        session.header = sanitizedQuestion;
        roomSessions[roomId] = { ...session, stage: 3 };
        const message = 'Thank you! Now, please provide the text associated with the header.';
        io.to(roomId).emit("newToken", message);
        return res.status(200).json({ message });

      } else if (session.stage === 3) {
        session.text = sanitizedQuestion;
        roomSessions[roomId] = { ...session, stage: 1 };

        const pinecone = await getPinecone();
        const vectorStore = await PineconeStore.fromExistingIndex(
          new OpenAIEmbeddings({ modelName: "text-embedding-3-small", dimensions: 1536 }),
          {
            pineconeIndex: pinecone,
            namespace: PINECONE_NAME_SPACE,
            textKey: 'text',
          },
        );

        const questionEmbedder = new QuestionEmbedder(
          vectorStore,
          new OpenAIEmbeddings({ modelName: "text-embedding-3-small", dimensions: 1536 }),
          userEmail
        );

        const headerAndText = `${codePrefix} header: ${session.header} text: ${session.text}`;

        const embedQuestionResult = await questionEmbedder.embedQuestion(headerAndText, userEmail);
        if (embedQuestionResult) {
          const message = 'Your text has been successfully embedded.';
          io.to(roomId).emit("newToken", message);
          delete roomSessions[roomId];
          return res.status(200).json({ message });
        } else {
          console.error(`Embedding failed for roomId: ${roomId}`);
          const message = 'Embedding failed. Please try again.';
          io.to(roomId).emit("newToken", message);
          return res.status(500).json({ message });
        }
      }
    } else {
      const pinecone = await getPinecone();
      const vectorStore = await PineconeStore.fromExistingIndex(
        new OpenAIEmbeddings({ modelName: "text-embedding-3-small", dimensions: 1536 }),
        {
          pineconeIndex: pinecone,
          namespace: PINECONE_NAME_SPACE,
          textKey: 'text',
        },
      );

      const chain = makeChain(vectorStore, (token) => {
        if (roomId) {
          io.to(roomId).emit("newToken", token);
        }
      }, userEmail);

      const Documents = await chain.call(sanitizedQuestion, [], roomId, userEmail);
      return res.status(200).json({ sourceDocs: Documents });
    }
  } catch (error: any) {
    console.error('Error', error);
    return res.status(500).json({ error: error.message || 'Something went wrong' });
  }
}
