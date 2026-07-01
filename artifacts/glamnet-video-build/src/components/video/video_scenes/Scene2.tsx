import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene2() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 200),
      setTimeout(() => setPhase(2), 800),
      setTimeout(() => setPhase(3), 1600),
      setTimeout(() => setPhase(4), 3300),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center px-[10vw] z-10"
      initial={{ opacity: 0, x: '5vw' }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: '-5vw', filter: 'blur(5px)' }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="w-1/2 pr-[5vw] relative z-20">
        <motion.p 
          className="text-brand-400 font-sans tracking-[0.2em] uppercase text-[1.2vw] mb-4"
          initial={{ opacity: 0, y: 20 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
        >
          For Clients
        </motion.p>
        <motion.h2 
          className="text-[5vw] font-display leading-[1.1] mb-6"
          initial={{ opacity: 0, y: 40 }}
          animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          Book SA's Top <br/><span className="text-brand-300 italic font-light">Beauty Talent</span>
        </motion.p>
        <motion.div 
          className="flex flex-col gap-4"
          initial={{ opacity: 0 }}
          animate={phase >= 3 ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.8 }}
        >
          <div className="flex items-center gap-4 border-b border-brand-800 pb-4">
            <div className="w-8 h-8 rounded-full border border-brand-500 flex items-center justify-center text-xs">01</div>
            <p className="text-[1.5vw] font-light font-sans">Makeup Artists & Stylists</p>
          </div>
          <div className="flex items-center gap-4 border-b border-brand-800 pb-4">
            <div className="w-8 h-8 rounded-full border border-brand-500 flex items-center justify-center text-xs">02</div>
            <p className="text-[1.5vw] font-light font-sans">Premium House Calls</p>
          </div>
        </motion.div>
      </div>

      <motion.div 
        className="w-1/2 h-[70vh] rounded-2xl overflow-hidden relative"
        initial={{ opacity: 0, scale: 0.9, rotateY: 15 }}
        animate={phase >= 2 ? { opacity: 1, scale: 1, rotateY: 0 } : { opacity: 0, scale: 0.9, rotateY: 15 }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        style={{ perspective: 1000 }}
      >
        <motion.div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${import.meta.env.BASE_URL}images/stylist.png)` }}
          animate={{ scale: [1, 1.05] }}
          transition={{ duration: 4, ease: 'linear' }}
        />
        <div className="absolute inset-0 ring-1 ring-inset ring-white/20 rounded-2xl" />
      </motion.div>
    </motion.div>
  );
}
