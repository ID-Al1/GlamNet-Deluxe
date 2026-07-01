import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { useVideoPlayer } from '@/lib/video/hooks';
import { Scene1 } from './video_scenes/Scene1';
import { Scene2 } from './video_scenes/Scene2';
import { Scene3 } from './video_scenes/Scene3';
import { Scene4 } from './video_scenes/Scene4';
import { Scene5 } from './video_scenes/Scene5';

export const SCENE_DURATIONS: Record<string, number> = {
  intro: 4500,
  clients: 4000,
  stylists: 4500,
  brands: 4000,
  outro: 4500,
};

const SCENE_COMPONENTS: Record<string, React.ComponentType> = {
  intro: Scene1,
  clients: Scene2,
  stylists: Scene3,
  brands: Scene4,
  outro: Scene5,
};

const SCENE_START_SEC: Record<string, number> = (() => {
  const out: Record<string, number> = {};
  let cumMs = 0;
  for (const [key, ms] of Object.entries(SCENE_DURATIONS)) {
    out[key] = cumMs / 1000;
    cumMs += ms;
  }
  return out;
})();

const AUDIO_SEEK_EPSILON = 0.18;

// Adapted for a 9:16 vertical stage, using vh/vw or % for positioning relative to the container
const scenePositions = [
  { x: '-30%', y: '-20%', scale: 1,   opacity: 0.3 },
  { x: '10%',  y: '10%',  scale: 1.5, opacity: 0.5 },
  { x: '40%',  y: '-10%', scale: 0.8, opacity: 0.4 },
  { x: '20%',  y: '50%',  scale: 1.2, opacity: 0.6 },
  { x: '-10%', y: '10%',  scale: 1,   opacity: 0.3 },
];

const blob2Positions = [
  { x: '40%', y: '50%' },
  { x: '-10%', y: '20%' },
  { x: '50%', y: '60%' },
  { x: '0%',  y: '-10%' },
  { x: '30%', y: '40%' },
];

export default function VideoTemplate({
  durations = SCENE_DURATIONS,
  loop = true,
  muted = false,
  onSceneChange,
}: {
  durations?: Record<string, number>;
  loop?: boolean;
  muted?: boolean;
  onSceneChange?: (sceneKey: string) => void;
} = {}) {
  const { currentSceneKey } = useVideoPlayer({ durations, loop });
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const baseSceneKey = currentSceneKey.replace(/_r[12]$/, '');
  const sceneIndex = Object.keys(SCENE_DURATIONS).indexOf(baseSceneKey);
  const SceneComponent = SCENE_COMPONENTS[baseSceneKey];

  useEffect(() => {
    onSceneChange?.(currentSceneKey);
  }, [currentSceneKey, onSceneChange]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 0.45;
    const targetTime = SCENE_START_SEC[baseSceneKey] ?? 0;
    if (Math.abs(audio.currentTime - targetTime) > AUDIO_SEEK_EPSILON) {
      audio.currentTime = targetTime;
    }
    audio.play().catch(() => {});
  }, [currentSceneKey, baseSceneKey]);

  const pos = scenePositions[sceneIndex] ?? scenePositions[0];
  const blob2pos = blob2Positions[sceneIndex] ?? blob2Positions[0];

  return (
    <div className="relative w-full h-screen overflow-hidden bg-brand-950 text-brand-50 flex items-center justify-center">
      {/* Persistent Background - fills the entire 16:9 viewport to prevent black bars */}
      <div className="absolute inset-0 z-0">
        <motion.div
          className="absolute inset-0 opacity-40 bg-cover bg-center mix-blend-overlay"
          style={{ backgroundImage: `url(${import.meta.env.BASE_URL}images/texture.png)` }}
          animate={{ scale: [1.1, 1.15, 1.1], rotate: [0, 2, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
        />
        <motion.div
          className="absolute inset-0 bg-gradient-to-tr from-brand-950 via-brand-900/80 to-brand-800/50"
        />
      </div>

      {/* 9:16 Vertical Stage */}
      <div className="relative h-full aspect-[9/16] bg-transparent overflow-hidden shadow-2xl z-10">
        {/* Persistent Midground inside the vertical stage */}
        <motion.div
          className="absolute w-[120vh] h-[120vh] rounded-full border border-brand-400/20 mix-blend-screen -translate-x-1/2 -translate-y-1/2"
          animate={pos}
          transition={{ duration: 2, ease: [0.22, 1, 0.36, 1] }}
        />
        <motion.div
          className="absolute w-[90vh] h-[90vh] rounded-full bg-brand-600/10 blur-[100px] -translate-x-1/2 -translate-y-1/2"
          animate={blob2pos}
          transition={{ duration: 2.5, ease: [0.22, 1, 0.36, 1] }}
        />

        <AnimatePresence mode="sync">
          {SceneComponent && <SceneComponent key={currentSceneKey} />}
        </AnimatePresence>
      </div>

      <audio
        ref={audioRef}
        src={`${import.meta.env.BASE_URL}audio/bg_music.mp3`}
        preload="auto"
        autoPlay
        muted={muted}
      />
    </div>
  );
}
