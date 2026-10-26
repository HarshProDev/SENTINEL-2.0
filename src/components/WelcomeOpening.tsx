import React, { useCallback, useEffect, useRef, useState } from 'react';
import { HeartPulse, RotateCw } from 'lucide-react';

const greetings = [
  'Hello',
  'Bonjour',
  'Hola',
  'Ciao',
  'こんにちは',
  'नमस्ते',
];

const GREETING_INTERVAL_MS = 500;

export const WelcomeOpening: React.FC = () => {
  const [isVisible, setIsVisible] = useState(true);
  const [isOpening, setIsOpening] = useState(false);
  const [greeting, setGreeting] = useState(greetings[0]);
  const [openingId, setOpeningId] = useState(0);
  const intervalRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);
  const greetingIndexRef = useRef(0);

  const startOpening = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
    }
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
    }
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
    }

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    greetingIndexRef.current = 0;
    setGreeting(prefersReducedMotion ? 'Welcome' : greetings[0]);
    setOpeningId((id) => id + 1);
    setIsOpening(false);
    setIsVisible(true);

    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;

      if (!prefersReducedMotion) {
        intervalRef.current = window.setInterval(() => {
          const nextIndex = greetingIndexRef.current + 1;
          if (nextIndex >= greetings.length) {
            if (intervalRef.current !== null) {
              window.clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
            return;
          }
          greetingIndexRef.current = nextIndex;
          setGreeting(greetings[greetingIndexRef.current]);
        }, GREETING_INTERVAL_MS);
      }

      timeoutRef.current = window.setTimeout(() => {
        if (intervalRef.current !== null) {
          window.clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        setIsOpening(true);
      }, prefersReducedMotion ? 500 : greetings.length * GREETING_INTERVAL_MS);
    });
  }, []);

  useEffect(() => {
    startOpening();

    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
      }
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, [startOpening]);

  return (
    <>
      {!isVisible && (
        <button
          type="button"
          className="welcome-replay"
          onClick={startOpening}
          aria-label="Replay SENTINEL welcome opening"
        >
          <RotateCw size={14} aria-hidden="true" />
          <span>Replay opening</span>
        </button>
      )}
      {isVisible && (
        <section
          className={`welcome-opening${isOpening ? ' is-opening' : ''}`}
          aria-label="Welcome to SENTINEL"
          aria-hidden={isOpening}
          onTransitionEnd={(event) => {
            if (event.target === event.currentTarget && event.propertyName === 'transform' && isOpening) {
              setIsVisible(false);
            }
          }}
        >
          <div className="opening-rings" aria-hidden="true"></div>
          <div className="opening-glass">
            <div className="opening-mark" aria-hidden="true">
              <HeartPulse size={34} strokeWidth={1.8} />
            </div>
            <p className="opening-brand">SENTINEL <span aria-hidden="true">·</span> PHYSIOLOGICAL MONITORING</p>
            <h1 className="opening-greeting" key={greeting} aria-live="off">{greeting}</h1>
            <p className="opening-subtitle">A thoughtful view of your body&apos;s signals.</p>
            <div className="opening-progress" aria-hidden="true">
              <span key={openingId}></span>
            </div>
          </div>
          <div className="opening-caption" aria-hidden="true">
            <span>PERSONAL MONITORING, MADE CLEAR</span>
            <span>EST. 2.0</span>
          </div>
        </section>
      )}
    </>
  );
};
