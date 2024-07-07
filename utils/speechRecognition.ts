const MicRecorder = require('mic-recorder-to-mp3');

export type RecordAudioReturnType = {
  start: () => void;
  stop: () => Promise<string>; // Changed to return base64 string
  stream: MediaStream;
};

// Function to record audio
export const recordAudio = (): Promise<RecordAudioReturnType> => {
  return new Promise((resolve) => {
    const recorder = new MicRecorder({ bitRate: 128 });
    
    const start = () => {
      recorder.start();
    };

    const stop = (): Promise<string> => {
      return new Promise((resolve) => {
        recorder.stop().getMp3().then(([buffer, blob]: [Buffer, Blob]) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64Data = reader.result as string;
            resolve(base64Data.split(',')[1]);
          };
          reader.readAsDataURL(blob);
        });
      });
    };

    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((stream) => {
        resolve({ start, stop, stream });
      });
  });
};

// Function to transcribe audio using Whisper API
export const transcribeAudio = async (audioBase64: string): Promise<string> => {
  const formData = new FormData();
  const blob = new Blob([Buffer.from(audioBase64, 'base64')], { type: 'audio/mp3' });
  formData.append('file', blob, 'audio.mp3');
  formData.append('model', 'whisper-1');
  formData.append('prompt', 'SolidCAM');
  formData.append('response_format', 'json');

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

    const result = await response.json();
    return result.text;
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
    const audioBase64 = await recorder.stop();
    const transcription = await transcribeAudio(audioBase64);
    return { transcription, recorder: null };
  } else {
    // Start recording
    const newRecorder = await recordAudio();
    newRecorder.start();
    return { transcription: 'Recording started', recorder: newRecorder };
  }
};

export default listen;