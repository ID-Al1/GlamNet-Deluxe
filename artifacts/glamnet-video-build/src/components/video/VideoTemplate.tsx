import { motion, AnimatePresence } from 'framer-motion';
import { useVideoPlayer } from '@/lib/video/hooks';
import { Scene1 } from './video_scenes/Scene1';
import { Scene2 } from './video_scenes/Scene2';
import { Scene3 } from './video_scenes/Scene3';
import { Scene4 } from './video_scenes/Scene4';
import { Scene5 } from './video_scenes/Scene5';

const SCENE_DURATIONS = {
  intro: 4500,
  clients: 4000,
  stylists: 4500,
  brands: 4000,
  outro: 4500
};

export default function VideoTemplate() {
  const { currentScene } = useVideoPlayer({ durations: SCENE_DURATIONS });

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#2a2524] text-brand-50">
      {/* Persistent Background */}
      <div className="absolute inset-0 z-0">
        <motion.div
          className="absolute inset-0 opacity-40 bg-cover bg-center mix-blend-overlay"
          style={{ backgroundImage: `url(${import.meta.env.BASE_URL}images/texture.png)` }}
          animate={{ scale: [1.1, 1.15, 1.1], rotate: [0, 2, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
        />
        <motion.div 
          className="absolute inset-0 bg-gradient-to-tr from-[#2a2524] via-[#4d3a36]/80 to-[#755146]/50"
        />
      </div>

      {/* Persistent Midground Shape */}
      <motion.div
        className="absolute w-[80vw] h-[80vw] rounded-full border border-brand-400/20 mix-blend-screen"
        animate={{
          x: ['-20vw', '10vw', '40vw', '60vw', '20vw'][currentScene],
          y: ['-40vh', '10vh', '-20vh', '50vh', '10vh'][currentScene],
          scale: [1, 1.5, 0.8, 1.2, 1],
          opacity: [0.3, 0.5, 0.4, 0.6, 0.3][currentScene],
        }}
        transition={{ duration: 2, ease: [0.22, 1, 0.36, 1] }}
      />
      <motion.div
        className="absolute w-[60vw] h-[60vw] rounded-full bg-brand-600/10 blur-[100px]"
        animate={{
          x: ['40vw', '-10vw', '50vw', '0vw', '30vw'][currentScene],
          y: ['50vh', '20vh', '60vh', '-10vh', '40vh'][currentScene],
        }}
        transition={{ duration: 2.5, ease: [0.22, 1, 0.36, 1] }}
      />

      <AnimatePresence mode="sync">
        {currentScene === 0 && <Scene1 key="intro" />}
        {currentScene === 1 && <Scene2 key="clients" />}
        {currentScene === 2 && <Scene3 key="stylists" />}
        {currentScene === 3 && <Scene4 key="brands" />}
        {currentScene === 4 && <Scene5 key="outro" />}
      </AnimatePresence>
    </div>
  );
}
