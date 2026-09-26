import { useEffect, useRef, useState } from "react";
import { ArrowRight, Pause, Play } from "@phosphor-icons/react";
import "./Welcome.css";

const scene = "/welcome/pixel-door-original.gif";

export default function Welcome() {
  const image = useRef<HTMLImageElement>(null);
  const still = useRef<HTMLCanvasElement>(null);
  const [paused, setPaused] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [ready, setReady] = useState(false);

  const freeze = () => {
    const source = image.current;
    const target = still.current;
    if (!source?.complete || !source.naturalWidth || !target) return;
    target.width = source.naturalWidth;
    target.height = source.naturalHeight;
    // Copy an original animation frame; never redraw or alter the artwork.
    target.getContext("2d")?.drawImage(source, 0, 0);
    setReady(true);
  };

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => { freeze(); setPaused(preference.matches); };
    preference.addEventListener("change", change);
    return () => preference.removeEventListener("change", change);
  }, []);

  return (
    <main className="welcome-page" aria-labelledby="welcome-title">
      <div className="welcome-scene" aria-hidden="true">
        <img ref={image} src={scene} alt="" onLoad={freeze} className={paused && ready ? "welcome-frame-hidden" : ""} draggable={false} fetchPriority="high" />
        <canvas ref={still} className={paused && ready ? "" : "welcome-frame-hidden"} />
      </div>
      <div className="welcome-wordmark" aria-label="Ming">Ming</div>
      <section className="welcome-content">
        <h1 id="welcome-title"><span>Welcome to</span><span>Ming — Every done comes with proof</span></h1>
        <a className="welcome-start" href="#studio"><span>Start</span><ArrowRight size={22} weight="bold" aria-hidden="true" /></a>
        <p>From “AI says it’s done”<br />to “I saw it pass.”</p>
      </section>
      <button className="welcome-motion" type="button" onClick={() => { if (!paused) freeze(); setPaused(!paused); }} aria-label={paused ? "Play background animation" : "Pause background animation"}>
        {paused ? <Play size={15} aria-hidden="true" /> : <Pause size={15} aria-hidden="true" />}<span>{paused ? "Play scene" : "Pause scene"}</span>
      </button>
    </main>
  );
}
