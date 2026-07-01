import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene1() {
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
      className="absolute inset-0 flex items-center justify-center overflow-hidden z-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }}
      transition={{ duration: 0.8 }}
    >
      <motion.div 
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${import.meta.env.BASE_URL}images/model1.png)` }}
        initial={{ scale: 1.2, opacity: 0 }}
        animate={phase >= 1 ? { scale: 1.05, opacity: 0.5 } : { scale: 1.2, opacity: 0 }}
        transition={{ duration: 2.5, ease: 'easeOut' }}
      />
      <motion.div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

      <div className="relative z-20 text-center flex flex-col items-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="mb-8"
        >
          {/* We assume the logo from glamnet artifact is copied to public, but I'll use text as fallback if missing */}
          <h1 className="text-[10vw] font-display font-medium tracking-tight leading-none text-brand-50">
            Glam<span className="text-brand-400 font-serif italic">Net</span>
          </h1>
        </motion.div>

        <motion.div
          className="overflow-hidden"
        >
          <motion.p 
            className="text-[2vw] font-sans font-light tracking-[0.2em] text-brand-200 uppercase"
            initial={{ y: "100%", opacity: 0 }}
            animate={phase >= 3 ? { y: "0%", opacity: 1 } : { y: "100%", opacity: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            Where Beauty Meets Opportunity
          </motion.p>
        </motion.div>
        
        <motion.div
          className="w-[1px] h-[8vh] bg-brand-400 mt-12 mx-auto origin-top"
          initial={{ scaleY: 0 }}
          animate={phase >= 3 ? { scaleY: 1 } : { scaleY: 0 }}
          transition={{ duration: 1, delay: 0.5, ease: "circOut" }}
        />
      </div>
    </motion.div>
  );
}
