import React, { useState, useRef, FC } from 'react';
import Image from 'next/image';
import { RecordAudioReturnType, recordAudio, transcribeAudio } from '../utils/speechRecognition';
import WaveSurfer from 'wavesurfer.js';
import RecordPlugin from 'wavesurfer.js/dist/plugins/record.js';
import styles from '@/styles/Home.module.css';
import { handleMicClickEvent } from '@/utils/tracking';

interface MicrophoneRecorderProps {
  setQuery: React.Dispatch<React.SetStateAction<string>>;
  loading: boolean;
  setIsTranscribing: React.Dispatch<React.SetStateAction<boolean>>;
  isTranscribing: boolean;
  setIsMicActive: React.Dispatch<React.SetStateAction<boolean>>; // Add this line
}

const MicrophoneRecorder: FC<MicrophoneRecorderProps> = ({ 
  setQuery, 
  loading, 
  setIsTranscribing, 
  isTranscribing,
  setIsMicActive // New prop
}) => {
  const [listening, setListening] = useState(false);
  const [recorder, setRecorder] = useState<RecordAudioReturnType | null>(null);
  const [recordingTime, setRecordingTime] = useState<number>(0);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handleMicClick = async () => {
    try {
      handleMicClickEvent();
      if (!listening) {
        const newRecorder = await recordAudio();
        newRecorder.start();
        setRecorder(newRecorder);
        setListening(true);
        setIsMicActive(true); // Set mic active
        setRecordingTime(0);

        setTimeout(() => {
          const container = document.getElementById('waveform');
          if (container) {
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
              });

              wavesurferRef.current = wavesurfer;

              if (record) {
                record.startRecording();
              }
            } catch (error) {
              console.error('Error initializing WaveSurfer:', error);
            }
          } else {
            console.error('WaveSurfer container not found');
          }
        }, 500);

        if (timerRef.current) {
          clearInterval(timerRef.current);
        }

        timerRef.current = setInterval(() => {
          setRecordingTime((prevTime) => prevTime + 1);
        }, 1000);
      } else {
        stopRecording();
      }
    } catch (err) {
      console.error('handleMicClick error:', err);
      cleanup();
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
  
      const transcription = await transcribeAudio(audioBlob);
      setQuery((prevQuery) => prevQuery + " " + transcription);
    } catch (error) {
      console.error("Error stopping recording:", error);
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
      recorder.stop();
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
    <div>
      {listening && (
        <div className={styles.waveContainer}>
          <div id="waveform" className={styles.soundVisual}></div>
          <button
            type="button"
            className={`${styles.stopRecordingButton} ${styles.squareButton}`}
            onClick={cleanup}
          >
            X
          </button>
          <div className={styles.timer}>
            {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
          </div>
          <button
            type="button"
            className={`${styles.checkRecordingButton} ${styles.circleButton}`}
            onClick={stopRecording}
          >
            ✓
          </button>
        </div>
      )}
      {!listening && !loading && (
        <label htmlFor="micInput" className={styles.micButton}>
          <input
            id="micInput"
            type="button"
            style={{ display: 'none' }}
            onClick={handleMicClick}
            disabled={isTranscribing}
          />
          <Image
            src="/icons8-mic-50.png"
            alt="Mic"
            className={styles.micIcon}
            width='30'
            height='30'
            style={{ opacity: listening || isTranscribing ? 0.5 : 1 }}
          />
        </label>
      )}
      {speechError && (
        <div className="border border-red-400 rounded-md p-4">
          <p className="text-red-500">{speechError}</p>
        </div>
      )}
    </div>
  );
};

export default MicrophoneRecorder;
