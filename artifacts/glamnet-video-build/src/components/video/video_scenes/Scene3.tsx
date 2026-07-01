import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene3() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 200),
      setTimeout(() => setPhase(2), 600),
      setTimeout(() => setPhase(3), 1400),
      setTimeout(() => setPhase(4), 3800),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-end px-[10vw] z-10"
      initial={{ opacity: 0, clipPath: 'circle(0% at 75% 50%)' }}
      animate={{ opacity: 1, clipPath: 'circle(150% at 75% 50%)' }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.div 
        className="absolute left-[10vw] w-[45vw] h-[60vh] bg-brand-800/40 backdrop-blur-xl border border-white/10 rounded-2xl p-8 flex flex-col justify-between"
        initial={{ opacity: 0, x: -50 }}
        animate={phase >= 2 ? { opacity: 1, x: 0 } : { opacity: 0, x: -50 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        <div className="space-y-6">
          <div className="w-12 h-1 bg-brand-400" />
          <h3 className="text-[2.5vw] font-display leading-tight">Grow your beauty career on your terms.</h3>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          {['Manage Bookings', 'Income Tracking', 'Build Portfolio', 'Get Referrals'].map((item, i) => (
            <motion.div 
              key={i}
              className="bg-brand-900/50 p-4 rounded-xl border border-white/5"
              initial={{ opacity: 0, y: 20 }}
              animate={phase >= 3 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
            >
              <div className="w-2 h-2 rounded-full bg-brand-400 mb-2" />
              <p className="text-[1.2vw] font-sans font-medium">{item}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>

      <div className="w-[40vw] pl-[5vw] relative z-20 text-right">
        <motion.p 
          className="text-brand-400 font-sans tracking-[0.2em] uppercase text-[1.2vw] mb-4"
          initial={{ opacity: 0, y: 20 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
        >
          For Artists
        </motion.p>
        <motion.h2 
          className="text-[5.5vw] font-display leading-[1] mb-6"
          initial={{ opacity: 0, y: 40 }}
          animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          Your <br/><span className="text-brand-300 italic font-light">Business</span><br/>Elevated
        </motion.h2>
      </div>
    </motion.div>
  );
}
