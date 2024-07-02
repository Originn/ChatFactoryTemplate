export type RecordAudioReturnType = {
  start: () => void;
  stop: () => Promise<Blob>;
  stream: MediaStream;
};

// Function to record audio
export const recordAudio = (): Promise<RecordAudioReturnType> => {
  return new Promise(async (resolve) => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    let audioChunks: Blob[] = [];

    mediaRecorder.addEventListener('dataavailable', (event) => {
      audioChunks.push(event.data);
    });

    const start = () => {
      mediaRecorder.start();
    };
    const stop = (): Promise<Blob> => {
      return new Promise((resolve) => {
        mediaRecorder.addEventListener('stop', () => {
          const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
          audioChunks = [];
          resolve(audioBlob);
        });

        mediaRecorder.stop();
      });
    };

    resolve({ start, stop, stream });
  });
};

// Function to transcribe audio using Whisper API
export const transcribeAudio = async (audioBlob: Blob): Promise<string> => {
  const formData = new FormData();
  formData.append('file', audioBlob, 'audio.wav');
  formData.append('model', 'whisper-1');
  formData.append('response_format', 'json'); // Change this to 'json'

  try {
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const result = await response.json();
      return result.text;
    } else {
      const text = await response.text();
      return text;
    }
  } catch (error) {
    console.error('Transcription error:', error);
    throw error;
  }
};

// Function to listen and transcribe using Whisper API
const listen = async (isRecording: boolean, recorder: RecordAudioReturnType | null): Promise<{ transcription: string, recorder: RecordAudioReturnType | null }> => {
  if (isRecording) {
    // Stop recording
    if (!recorder) throw new Error('No recorder available');
    const audioBlob = await recorder.stop();
    const transcription = await transcribeAudio(audioBlob);
    return { transcription, recorder: null };
  } else {
    // Start recording
    const newRecorder = await recordAudio();
    newRecorder.start();
    return { transcription: 'Recording started', recorder: newRecorder };
  }
};

export default listen;
