import React, { useState, useRef, FC, useEffect } from 'react';
import Image from 'next/image';
import { Box, IconButton, Tooltip } from '@mui/material';
import StopIcon from '@mui/icons-material/Close';
import CheckIcon from '@mui/icons-material/Check';
import MicIcon from '@mui/icons-material/Mic';
import { RecordAudioReturnType, recordAudio, transcribeAudio } from '@/utils/speechRecognition';
import WaveSurfer from 'wavesurfer.js';
import RecordPlugin from 'wavesurfer.js/dist/plugins/record.js';
import { handleMicClickEvent } from '@/utils/tracking';

interface MicrophoneRecorderProps {
  setQuery: React.Dispatch<React.SetStateAction<string>>;
  loading: boolean;
  setIsTranscribing: React.Dispatch<React.SetStateAction<boolean>>;
  isTranscribing: boolean;
  setIsMicActive: React.Dispatch<React.SetStateAction<boolean>>;
}

const MicrophoneRecorder: FC<MicrophoneRecorderProps> = ({ 
  setQuery, 
  loading, 
  setIsTranscribing, 
  isTranscribing,
  setIsMicActive
}) => {
  const [listening, setListening] = useState(false);
  const [recorder, setRecorder] = useState<RecordAudioReturnType | null>(null);
  const [recordingTime, setRecordingTime] = useState<number>(0);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up resources when component unmounts
  useEffect(() => {
    return () => cleanup();
  }, []);

  const initializeWavesurfer = () => {
    const container = document.getElementById('waveform');
    if (!container) {
      console.error('WaveSurfer container not found');
      return null;
    }

    try {
      const wavesurfer = WaveSurfer.create({
        container: '#waveform',
        waveColor: 'rgb(200, 0, 200)',
        progressColor: 'rgb(100, 0, 100)',
        height: 50,
        barWidth: 3,
        barHeight: 15,
        barGap: 2,
        hideScrollbar: true,
        cursorWidth: 0,
        interact: false,
      });

      const record = wavesurfer.registerPlugin(RecordPlugin.create({
        scrollingWaveform: false,
        renderRecordedAudio: false,
      }));

      record.on('record-start', () => {
        // Recording started event handler
      });

      if (record) {
        record.startRecording();
      }

      return wavesurfer;
    } catch (error) {
      console.error('Error initializing WaveSurfer:', error);
      return null;
    }
  };

  const startRecording = async () => {
    try {
      const newRecorder = await recordAudio();
      newRecorder.start();
      setRecorder(newRecorder);
      setListening(true);
      setIsMicActive(true);
      setRecordingTime(0);
      setSpeechError(null);

      // Initialize timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      timerRef.current = setInterval(() => {
        setRecordingTime((prevTime) => prevTime + 1);
      }, 1000);

      // Initialize wavesurfer after a short delay to ensure DOM is ready
      setTimeout(() => {
        const wavesurfer = initializeWavesurfer();
        if (wavesurfer) {
          wavesurferRef.current = wavesurfer;
        }
      }, 500);
    } catch (err) {
      console.error('Failed to start recording:', err);
      setSpeechError('Could not access microphone. Please check your browser permissions.');
      cleanup();
    }
  };

  const handleMicClick = async () => {
    handleMicClickEvent();
    if (!listening) {
      await startRecording();
    } else {
      await stopRecording();
    }
  };
  const stopRecording = async () => {
    if (!recorder) return;
  
    try {
      const audioBlob = await recorder.stop();
  
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
        wavesurferRef.current = null;
      }
  
      // Ensure all tracks are stopped
      if (recorder.stream) {
        recorder.stream.getTracks().forEach(track => {
          track.stop();
          recorder.stream.removeTrack(track);
        });
      }
  
      setIsTranscribing(true);
  
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
  
      try {
        const transcription = await transcribeAudio(audioBlob);
        setQuery(prevQuery => {
          const trimmedPrev = prevQuery.trim();
          return trimmedPrev ? `${trimmedPrev} ${transcription}` : transcription;
        });
      } catch (error) {
        console.error("Transcription error:", error);
        setSpeechError("Failed to transcribe audio. Please try again.");
      }
    } catch (error) {
      console.error("Error stopping recording:", error);
      setSpeechError("Error processing recording. Please try again.");
    } finally {
      setListening(false);
      setRecorder(null);
      setIsTranscribing(false);
      setIsMicActive(false);
      setRecordingTime(0);
    }
  };

  const cleanup = () => {
    if (recorder) {
      recorder.stop().catch(err => console.error("Error stopping recorder during cleanup:", err));
      if (recorder.stream) {
        recorder.stream.getTracks().forEach(track => {
          track.stop();
          recorder.stream.removeTrack(track);
        });
      }
    }
  
    if (wavesurferRef.current) {
      wavesurferRef.current.destroy();
      wavesurferRef.current = null;
    }
  
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  
    setListening(false);
    setRecorder(null);
    setIsTranscribing(false);
    setIsMicActive(false);
    setRecordingTime(0);
  };


  return (
    <Box>
      {listening && (
        <Box display="flex" justifyContent="center" position="absolute" top={-29} right={4} bgcolor="#ffffff" height={50} width="22%" borderRadius={1}>
          <Box id="waveform" sx={{ width: '35%', height: 56, position: 'absolute', marginRight: 2 }}></Box>
          <IconButton onClick={cleanup} aria-label="Cancel recording" size="small" sx={{ ml: 5, mt: 1 }}>
            <StopIcon />
          </IconButton>
          <Box sx={{ fontSize: 16, ml: 'auto', display: 'flex', alignItems: 'center', p: 1 }}>
            {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
          </Box>
          <IconButton onClick={stopRecording} aria-label="Stop recording and transcribe" size="small" sx={{ mr: 1, mt: 1 }}>
            <CheckIcon />
          </IconButton>
        </Box>
      )}
      {!listening && !loading && (
        <Tooltip title="Record audio">
          <IconButton 
            onClick={handleMicClick} 
            disabled={isTranscribing} 
            size="small"
            sx={{ padding: '4px' }}
            aria-label="Record audio"
          >
            <MicIcon sx={{ 
              opacity: listening || isTranscribing ? 0.5 : 1,
              fontSize: '20px'
            }} />
          </IconButton>
        </Tooltip>
      )}
      {speechError && (
        <Box className="border border-red-400 rounded-md p-4">
          <p className="text-red-500">{speechError}</p>
        </Box>
      )}
    </Box>
  );
};

export default MicrophoneRecorder;