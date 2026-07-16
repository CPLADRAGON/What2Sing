'use client';

import {motion, useReducedMotion} from 'framer-motion';

export function ImportLoadingPanel({loadingSteps, title, body}: {loadingSteps: string[]; title: string; body: string}) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-karaoke/20 bg-karaoke/10 p-4">
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="h-full w-1/2 rounded-full bg-gradient-to-r from-karaoke to-karaoke-cyan"
          animate={{x: prefersReducedMotion ? '0%' : ['-100%', '220%']}}
          transition={prefersReducedMotion ? {duration: 0} : {duration: 1.45, repeat: Infinity, ease: 'easeInOut'}}
        />
      </div>
      <p className="mt-3 text-sm font-black text-white">{title}</p>
      <p className="mt-1 text-xs leading-5 text-body-muted">{body}</p>
      <div className="mt-3 grid gap-2">
        {loadingSteps.map((step, index) => (
          <div key={step} className="flex items-center gap-2 text-xs text-ink-soft">
            <span className="h-1.5 w-1.5 rounded-full bg-karaoke-cyan" style={{opacity: 1 - index * 0.2}} />
            {step}
          </div>
        ))}
      </div>
    </div>
  );
}
