import React, { memo } from 'react';
import { Heart, HeartPulse } from 'lucide-react';

export const WelcomeHero: React.FC = memo(() => (
  <section className="welcome-hero" aria-labelledby="welcome-title">
    <div className="welcome-copy">
      <div className="welcome-eyebrow">
        <span aria-hidden="true"></span>
        Physiological response monitoring
      </div>
      <h1 id="welcome-title">
        Welcome to <span>SENTINEL 2.0</span>
      </h1>
      <p>
        A clearer view of your body&apos;s signals. Explore pulse and skin-response
        readings in one thoughtful monitoring workspace.
      </p>
      <div className="welcome-byline">
        <Heart className="welcome-byline-heart" size={15} fill="currentColor" aria-hidden="true" />
        <span>
          Made with care by <strong>Harsh &amp; Bhupesh</strong>
        </span>
      </div>
    </div>
    <div className="welcome-visual" aria-hidden="true">
      <div className="welcome-halo"></div>
      <svg className="welcome-trace" viewBox="0 0 212 44" preserveAspectRatio="none">
        <path d="M0 23 H49 L62 23 L70 18 L78 29 L87 6 L98 37 L108 22 H132 L142 23 L151 14 L160 28 L169 21 H212" />
      </svg>
      <div className="welcome-heart-mark">
        <HeartPulse size={34} strokeWidth={1.8} />
      </div>
    </div>
  </section>
));
