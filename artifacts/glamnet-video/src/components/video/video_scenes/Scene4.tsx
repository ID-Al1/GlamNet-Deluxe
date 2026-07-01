import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene4() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 200),
      setTimeout(() => setPhase(2), 800),
      setTimeout(() => setPhase(3), 1400),
      setTimeout(() => setPhase(4), 3300),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center px-[10%] py-[9vh] gap-[3vh] z-10"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, y: '-10vh' }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="text-center z-20 w-full flex-shrink-0">
        <motion.p 
          className="text-brand-400 font-sans tracking-[0.2em] uppercase text-[2vh] mb-4"
          initial={{ opacity: 0, y: 20 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
        >
          For Brands
        </motion.p>
        <motion.h2 
          className="text-[6.5vh] font-display leading-[1.1]"
          initial={{ opacity: 0, y: 40 }}
          animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          Discover & Cast <br/><span className="text-brand-300 italic font-light">Authentic Voices</span>
        </motion.h2>
      </div>

      <div className="flex flex-col gap-4 w-full z-20">
        {[
          { title: "Run Casting Calls", subtitle: "Find the perfect face" },
          { title: "Connect with Talent", subtitle: "Direct industry access" },
          { title: "Curate Campaigns", subtitle: "Streamlined workflow" }
        ].map((item, i) => (
          <motion.div
            key={i}
            className="w-full bg-brand-900/60 backdrop-blur-md rounded-2xl border border-brand-400/20 flex flex-col items-center justify-center py-6 px-4 text-center relative overflow-hidden group"
            initial={{ opacity: 0, y: 30 }}
            animate={phase >= 3 ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
            transition={{ duration: 0.6, delay: i * 0.15, type: 'spring', stiffness: 100 }}
          >
            <motion.div 
              className="absolute inset-0 bg-gradient-to-b from-brand-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
            />
            <h4 className="text-[3vh] font-display mb-2">{item.title}</h4>
            <p className="text-[1.8vh] font-sans text-brand-300 font-light uppercase tracking-wider">{item.subtitle}</p>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
