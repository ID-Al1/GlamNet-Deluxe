import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene5() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 200),
      setTimeout(() => setPhase(2), 1000),
      setTimeout(() => setPhase(3), 1800),
      setTimeout(() => setPhase(4), 3800),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden z-10 bg-brand-950 px-[10%]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1 }}
    >
      {/* Background elements */}
      <motion.div 
        className="absolute inset-0 bg-cover bg-center opacity-30 mix-blend-luminosity"
        style={{ backgroundImage: `url(${import.meta.env.BASE_URL}images/model1.png)` }}
        animate={{ scale: [1.1, 1], filter: ['blur(20px)', 'blur(10px)'] }}
        transition={{ duration: 4, ease: 'easeOut' }}
      />
      <motion.div className="absolute inset-0 bg-gradient-to-t from-brand-950 via-brand-950/80 to-brand-950/40" />

      <div className="relative z-20 text-center flex flex-col items-center w-full">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={phase >= 2 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          className="mb-6 flex flex-col items-center"
        >
          <h1 className="text-[14vh] font-display font-medium tracking-tight leading-none text-brand-50 drop-shadow-2xl">
            Glam<span className="text-brand-400 font-serif italic">Net</span>
          </h1>
        </motion.div>

        <motion.div
          className="overflow-hidden mb-12"
        >
          <motion.p 
            className="text-[2.5vh] font-sans font-light tracking-[0.3em] text-brand-200 uppercase"
            initial={{ y: "100%", opacity: 0 }}
            animate={phase >= 3 ? { y: "0%", opacity: 1 } : { y: "100%", opacity: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            Join The Community
          </motion.p>
        </motion.div>

        <motion.div
          className="w-full max-w-2xl h-[1px] bg-gradient-to-r from-transparent via-brand-400 to-transparent opacity-50"
          initial={{ scaleX: 0 }}
          animate={phase >= 1 ? { scaleX: 1 } : { scaleX: 0 }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
        />
      </div>
    </motion.div>
  );
}
