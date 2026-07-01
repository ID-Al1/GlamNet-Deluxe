import { useEffect, useState } from 'react';

/**
 * useVideoPlayer - DO NOT MODIFY
 * This hook is required for the video recording lifecycle to work correctly.
 */
export function useVideoPlayer({ durations }: { durations: Record<string, number> }) {
  const [currentScene, setCurrentScene] = useState(0);
  const durationValues = Object.values(durations);

  useEffect(() => {
    // Let the recording system know we've started playing
    if (typeof window !== 'undefined' && (window as any).startRecording) {
      (window as any).startRecording();
    }

    let timeoutId: ReturnType<typeof setTimeout>;
    let isFirstPass = true;

    const playNext = (index: number) => {
      setCurrentScene(index);
      const duration = durationValues[index];

      timeoutId = setTimeout(() => {
        const nextIndex = index + 1;
        if (nextIndex < durationValues.length) {
          playNext(nextIndex);
        } else {
          // One full pass completed
          if (isFirstPass) {
            isFirstPass = false;
            if (typeof window !== 'undefined' && (window as any).stopRecording) {
              (window as any).stopRecording();
            }
          }
          // Loop back to the beginning
          playNext(0);
        }
      }, duration);
    };

    // Start playing
    if (durationValues.length > 0) {
      playNext(0);
    }

    return () => {
      clearTimeout(timeoutId);
    };
  }, [durations]);

  return { currentScene };
}
