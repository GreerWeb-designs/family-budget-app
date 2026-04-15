import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import logoUrl from "../assets/nestotter-logo.svg";

interface SplashProps {
  onDone: () => void;
}

export function Splash({ onDone }: SplashProps) {
  const [done, setDone] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDone(true), 2000);
    return () => clearTimeout(t);
  }, []);

  // Once the exit animation finishes, notify parent
  function handleExitComplete() {
    onDone();
  }

  return (
    <AnimatePresence onExitComplete={handleExitComplete}>
      {!done && (
        <motion.div
          key="splash"
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-cream-50"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeIn" }}
        >
          <img
            src={logoUrl}
            alt="NestOtter"
            style={{
              width: "60vw",
              maxWidth: 368,
              height: "auto",
            }}
            draggable={false}
          />
          <h1
            style={{
              fontFamily: "'Fraunces', Georgia, serif",
              fontWeight: 500,
              fontSize: 36,
              color: "var(--color-ink-900)",
              letterSpacing: "-0.01em",
              marginTop: 20,
              lineHeight: 1,
            }}
          >
            NestOtter
          </h1>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
