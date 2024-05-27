import type { NextApiRequest, NextApiResponse } from 'next';
import { OpenAIEmbeddings } from '@langchain/openai';
import { PineconeStore } from '@langchain/pinecone';
import { makeChain } from '@/utils/makechain';
import { getPinecone } from '@/utils/pinecone-client';
import { PINECONE_NAME_SPACE } from '@/config/pinecone';
import { getIO } from "@/socketServer.cjs";
import { QuestionEmbedder } from "@/scripts/QuestionEmbedder";
import createClient from "openai";

// Initialize OpenAI client
const openAIClient = new createClient({
});

interface RoomSession {
  stage: number;
  header?: string;
  text?: string;
  images?: { url: string, description?: string }[];
}

const roomSessions: { [key: string]: RoomSession } = {};

// Utility function to get image description
async function getImageDescription(imageUrl: string, roomId: string) {
  const io = getIO();
  try {
    const response = await openAIClient.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Please describe the image as best as you can" },
            {
              type: "image_url",
              image_url: { url: imageUrl },
            },
          ],
        },
      ],
      max_tokens: 300,
      stream: true, // Enable streaming
    });

    let description = '';
    for await (const token of response) {
      if (token.choices[0]?.delta?.content) {
        description += token.choices[0].delta.content;
        io.to(roomId).emit("newToken", token.choices[0].delta.content);
      }
    }

    return description;
  } catch (error) {
    console.error('Error getting image description:', error);
    io.to(roomId).emit("newToken", "Error getting image description.");
    return "Error getting image description.";
  }
}

// Utility function to handle embedding and response
async function handleEmbeddingAndResponse(session: RoomSession, roomId: string, userEmail: string) {
  const io = getIO();
  const codePrefix = 'embed-4831-embed-4831';

  // Proceed directly to the embedding logic
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

  const imagesText = session.images?.map(img => `${img.url} image description: ${img.description}`).join(' ') || '';
  const headerAndText = `${codePrefix} header: ${session.header} ${imagesText} text: ${session.text}`;
  const embedQuestionResult = await questionEmbedder.embedQuestion(headerAndText, userEmail);
  if (embedQuestionResult) {
    const message = '\n\n**Your text and images (if provided) have been successfully embedded.**';
    io.to(roomId).emit("newToken", message);

    // Emit an event to remove the thumbnails from the frontend
    io.to(roomId).emit("removeThumbnails");
    io.to(roomId).emit("resetStages");

    delete roomSessions[roomId];
    return { status: 200, message };
  } else {
    console.error(`Embedding failed for roomId: ${roomId}`);
    const message = 'Embedding failed. Please try again.';
    io.to(roomId).emit("newToken", message);
    return { status: 500, message };
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { question, roomId, userEmail, imageUrl, history } = req.body;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!roomId) {
    return res.status(400).json({ message: 'No roomId in the request' });
  }

  const sanitizedQuestion = question?.trim().replaceAll('\n', ' ');
  const codePrefix = 'embed-4831-embed-4831';
  const io = getIO();

  try {
    let session = roomSessions[roomId];

    // Check if the question is an image URL and history contains the codePrefix
    const isImageUrl = sanitizedQuestion?.startsWith('https://storage.googleapis.com/solidcam/');
    const hasCodePrefixInHistory = history && history.length >= 3 && history[history.length - 3][0].includes(codePrefix);

    if (isImageUrl && hasCodePrefixInHistory) {
      session = session || { stage: 4, header: '', text: '', images: [] };

      // Ensure images array is initialized
      if (!session.images) {
        session.images = [];
      }

      // Extract header and text from history
      const headerEntry = history[history.length - 2];
      const textEntry = history[history.length - 1];

      session.header = headerEntry ? headerEntry[0].replace(codePrefix, '').trim() : session.header;
      session.text = textEntry ? textEntry[0] : session.text;
      const imageUrls = sanitizedQuestion.split(' ');
      for (const url of imageUrls) {
        if (url.startsWith('https://storage.googleapis.com/solidcam/')) {
          session.images.push({ url });
        }
      }

      roomSessions[roomId] = session;

      for (let img of session.images ?? []) {
        if (!img.description) {
          img.description = await getImageDescription(img.url, roomId);
          img.description += " [END OF DESCRIPTION]";
        }
      }

      const result = await handleEmbeddingAndResponse(session, roomId, userEmail);
      return res.status(result.status).json({ message: result.message });

    } else if (hasCodePrefixInHistory) {
      // Handle cases where there is no image but hasCodePrefixInHistory is true
      session = session || { stage: 4, header: '', text: '' };

      // Extract header and text from history
      const headerEntry = history[history.length - 2];
      const textEntry = history[history.length - 1];

      session.header = headerEntry ? headerEntry[0].replace(codePrefix, '').trim() : session.header;
      session.text = textEntry ? textEntry[0] : session.text;

      roomSessions[roomId] = session;

      const result = await handleEmbeddingAndResponse(session, roomId, userEmail);
      return res.status(result.status).json({ message: result.message });
    }

    if (sanitizedQuestion && sanitizedQuestion.startsWith(codePrefix)) {
      session = { stage: 1 };
      roomSessions[roomId] = session;
    }

    if (session) {
      if (session.stage === 1) {
        const message = 'You have entered the internal embedding mode for SolidCAM ChatBot.\n\n Please provide a **header** for the content and include a **link** if relevant.';
        roomSessions[roomId] = { ...session, stage: 2 };
        io.to(roomId).emit("newToken", message);
        return res.status(200).json({ message });

      } else if (session.stage === 2) {
        session.header = sanitizedQuestion;
        roomSessions[roomId] = { ...session, stage: 3 };
        io.to(roomId).emit("storeHeader", session.header);
        const message = 'Thank you! Now, please provide the **text** associated with the header.';
        io.to(roomId).emit("newToken", message);
        return res.status(200).json({ message });

      } else if (session.stage === 3) {
        session.text = sanitizedQuestion;
        roomSessions[roomId] = { ...session, stage: 4 };
        const message = 'If you have an **image** to upload, please do so now. If image is not needed click submit.';
        io.to(roomId).emit("newToken", message);
        io.to(roomId).emit("stageUpdate", 4);
        return res.status(200).json({ message });

      }

    } else {
      if (!question) {
        return res.status(400).json({ message: 'No question in the request' });
      }

      // Proceed to the embedding logic for cases without images
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
