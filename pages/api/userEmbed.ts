// pages/api/userEmbed.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getIO } from "@/socketServer.cjs";
import createClient from "openai";
import { OpenAIEmbeddings } from '@langchain/openai';
import { PineconeStore } from '@langchain/pinecone';
import { getPinecone } from '@/utils/pinecone-client';
import { PINECONE_NAME_SPACE } from '@/config/pinecone';
import { QuestionEmbedder } from "@/scripts/QuestionEmbedder";
import MemoryService from '@/utils/memoryService';

// Import your DB session methods
import {
  getRoomSession,
  createRoomSession,
  updateRoomSession,
  deleteRoomSession,
} from '@/utils/roomSessionsDb'; // adjust path if needed

// The (optional) Embeddings-based client
const openAIClient = new createClient({});

// Utility to fetch an image description (if you're using a standard GPT model)
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
    });

    const description = response.choices?.[0]?.message?.content || "No description found.";
    io.to(roomId).emit(`tokenStream-${roomId}`, description);
    return description;
  } catch (error) {
    console.error('Error getting image description:', error);
    io.to(roomId).emit(`tokenStream-${roomId}`, 'Error getting image description.');
    return 'Error getting image description.';
  }
}

// Embedding + response
async function handleEmbeddingAndResponse(roomId: string, userEmail: string) {
  const io = getIO();

  // 1) Retrieve the current row from DB again, in case it's updated
  const session = await getRoomSession(roomId);
  if (!session) {
    throw new Error(`No session found in DB for roomId=${roomId} during embedding.`);
  }

  const { header, text, images } = session;
  const codePrefix = 'embed-4831-embed-4831';

  // 2) Construct the text to embed
  const imagesText = images?.map(
    (img: any) => `${img.url} image description: ${img.description}`
  ).join(' ') || '';

  const headerAndText = `${codePrefix} header: ${header} ${imagesText} text: ${text}`;

  try {
    // 3) Connect to Pinecone
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

    // 4) Embed
    const embedQuestionResult = await questionEmbedder.embedQuestion(headerAndText, userEmail);
    if (!embedQuestionResult) {
      throw new Error('Embedding failed. Please try again.');
    }

    // 5) Notify UI
    const message = '\n\n**Your text and images (if provided) have been successfully embedded.**';
    io.to(roomId).emit(`tokenStream-${roomId}`, message);
    io.to(roomId).emit("removeThumbnails");
    io.to(roomId).emit(`resetStages-${roomId}`, 4);
    io.to(roomId).emit('embeddingComplete');
    io.to(roomId).emit("uploadStatus", "Upload and processing complete.");

    // 6) Delete the session from DB now that we are finished
    await deleteRoomSession(roomId);

    return { status: 200, message };
  } catch (err) {
    console.error('Error during embedding for roomId:', roomId, err);
    io.to(roomId).emit(`tokenStream-${roomId}`, 'Embedding process encountered an error. Please try again.');
    io.to(roomId).emit("uploadStatus", "Upload and processing failed.");
    return { status: 500, message: (err as Error).message || 'Error in embedding' };
  }
}

// Keep or adapt your syncChatHistory logic
async function syncChatHistory(roomId: string, clientHistory: any[], userEmail: string) {
  const serverHistory = await MemoryService.getChatHistory(roomId);

  if (clientHistory.length > serverHistory.length) {
    // Clear existing server history
    MemoryService.clearChatMemory(roomId);
    // Reconstruct the history from client data
    for (const [input, output] of clientHistory) {
      await MemoryService.updateChatMemory(roomId, input, output, [], userEmail);
    }
  } else {
    console.log('Server history is up to date');
  }
}

/**
 * This is your Next.js API handler for the embedding flow.
 *
 * 1) It uses a DB-based session (room_sessions table) instead of an in-memory object.
 * 2) The user enters codePrefix => stage=1 => provide header => stage=2 => provide text => stage=3 => optionally upload images => stage=4 => embed => delete session.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { question, history, roomId, imageUrls, userEmail } = req.body;
  if (!roomId) {
    return res.status(400).json({ message: 'No roomId in the request' });
  }

  // Possibly sync the user’s chat history
  await syncChatHistory(roomId, history, userEmail);

  const sanitizedQuestion = question?.trim().replaceAll('\n', ' ');
  const codePrefix = 'embed-4831-embed-4831';
  const io = getIO();

  try {
    // 1) Load the existing session row from DB
    let session = await getRoomSession(roomId);

    // If user typed the code prefix but there's no session, create it
    if (sanitizedQuestion && sanitizedQuestion.startsWith(codePrefix)) {
      if (!session) {
        // stage=1: user just typed code prefix => request header
        session = await createRoomSession(roomId, 1, null, null, []);
      } else {
        // Possibly reset or do nothing
        // e.g. session = await updateRoomSession(roomId, 1, null, null, []);
      }
    }

    // If no session at this point => 400
    if (!session) {
      return res.status(400).json({ message: 'Invalid request: no session found or created.' });
    }

    // Keep local copies for convenience
    let { stage, header, text, images } = session;
    images = images || [];

    // 2) Check if user is uploading images (i.e., `imageUrls` is not empty).
    const isImageUrls = imageUrls?.length > 0;

    // 2a) If user is uploading images, we assume stage=4 or at least finalize
    if (isImageUrls) {
      // Force stage=4 if not already
      if (stage < 4) stage = 4;

      // Keep the same header/text from DB
      // But update images with new URLs if any
      for (const url of imageUrls) {
        // If not already in array, push it
        if (!images.some((img: any) => img.url === url)) {
          images.push({ url });
        }
      }

      // If the user might have typed some text for image descriptions:
      // or you parse the question
      // ...

      // 2b) fetch/generate descriptions for each new image
      for (const img of images) {
        if (!img.description) {
          if (img.url.includes("linkedin")) {
            img.description = "LinkedIn image URL, no description fetched.";
          } else {
            img.description = await getImageDescription(img.url, roomId);
          }
        }
      }

      // 2c) Update DB session
      session = await updateRoomSession(roomId, stage, header ?? '', text ?? '', images);

      // 2d) Now embed and finalize
      io.to(roomId).emit("uploadStatus", "Uploading and processing your data...");
      const result = await handleEmbeddingAndResponse(roomId, userEmail);
      return res.status(result.status).json({ message: result.message });
    }

    // 3) If user is not uploading images but we are at stage=4 => embed final
    if (stage === 4) {
      const result = await handleEmbeddingAndResponse(roomId, userEmail);
      return res.status(result.status).json({ message: result.message });
    }

    // 4) If user is providing normal text input (stage=1 => ask for header, stage=2 => get header => ask for text, etc.)
    if (stage === 1) {
      // user should provide the header now
      // e.g. removing the codePrefix from the question
      const newHeader = sanitizedQuestion.replace(codePrefix, '').trim();
      stage = 2;
      await updateRoomSession(roomId, stage, newHeader, text ?? '', images);

      const msg = 'You have entered embedding mode. Please provide a **header** (and link if relevant).';
      io.to(roomId).emit(`tokenStream-${roomId}`, msg);
      return res.status(200).json({ message: msg });
    } 
    else if (stage === 2) {
      // user is providing the actual header text
      // next => stage=3
      stage = 3;
      await updateRoomSession(roomId, stage, sanitizedQuestion, text ?? '', images);

      const msg = 'Thank you! Now, please provide the **text** associated with that header.';
      io.to(roomId).emit(`tokenStream-${roomId}`, msg);
      return res.status(200).json({ message: msg });
    }
    else if (stage === 3) {
      // user provided the main text => proceed to stage=4 for image or final embed
      stage = 4;
      await updateRoomSession(roomId, stage, header ?? '', sanitizedQuestion, images);

      const msg = 'If you have an **image** to upload, do so now. Or click submit to finalize embedding.';
      io.to(roomId).emit(`tokenStream-${roomId}`, msg);
      io.to(roomId).emit(`stageUpdate-${roomId}`, 4);
      return res.status(200).json({ message: msg });
    }

    // If none of the above matched, we consider it invalid
    return res.status(400).json({ message: 'Invalid request flow.' });

  } catch (error: any) {
    console.error('Error in userEmbed handler:', error);
    return res.status(500).json({ error: error.message || 'Something went wrong' });
  }
}
