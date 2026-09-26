import { useEffect, useRef, useState } from "react";
import { ArrowRight, Pause, Play } from "@phosphor-icons/react";
import { welcomeSceneAt } from "./welcome-scene";
import "./Welcome.css";

const room = "/welcome/inspection-room.png";
const atlas = "/welcome/inspection-cast.png";
function spriteStyle(column: number, row: number) {
  // Crop the generated atlas at its actual boundaries; the inspector's head
  // begins above the nominal third row. Preserve the original PNG untouched.
  const y = row === 0 ? 0 : row === 1 ? 380 : 695;
  const height = row === 0 ? 362 : row === 1 ? 314 : 350;
  return { backgroundImage: `url(${atlas})`, height: `${height / 362 * 100}%`,
    backgroundSize: `400% ${1086 / height * 100}%`, backgroundPosition: `${column / 3 * 100}% ${y / (1086 - height) * 100}%` };
}

export default function Welcome() {
  const elapsed = useRef(0);
  const [time, setTime] = useState(0);
  const [paused, setPaused] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [visible, setVisible] = useState(() => document.visibilityState !== "hidden");
  const [roomReady, setRoomReady] = useState(false);
  const [castReady, setCastReady] = useState(false);
  const ready = roomReady && castReady;
  const scene = welcomeSceneAt(time);
  const motionPaused = paused || !visible || !ready;

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const changed = () => { if (preference.matches) setPaused(true); };
    const visibility = () => setVisible(document.visibilityState !== "hidden");
    preference.addEventListener("change", changed);
    document.addEventListener("visibilitychange", visibility);
    return () => { preference.removeEventListener("change", changed); document.removeEventListener("visibilitychange", visibility); };
  }, []);

  useEffect(() => {
    if (motionPaused) return;
    let frame = 0, previous = performance.now(), painted = previous;
    const tick = (now: number) => {
      elapsed.current += Math.min(100, Math.max(0, now - previous)); previous = now;
      if (now - painted >= 32) { setTime(elapsed.current); painted = now; }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [motionPaused]);

  return (
    <main className="welcome-page" aria-labelledby="welcome-title" data-scene-paused={motionPaused} data-scene-elapsed={Math.round(time)} data-scene-writing={scene.writing} data-scene-phase={scene.phase} data-scene-visitor={scene.visitor.name} data-scene-verdict={scene.visitor.verdict}>
      <div className="welcome-environment" aria-hidden="true"><img src={room} alt="" draggable={false} fetchPriority="high" onLoad={() => setRoomReady(true)} /></div>
      <img className="welcome-atlas-loader" src={atlas} alt="" aria-hidden="true" onLoad={() => setCastReady(true)} />
      <header className="welcome-header"><div className="welcome-wordmark" aria-label="Ming">Ming</div><span>Every done comes with proof.</span></header>
      <section className="welcome-content">
        <h1 id="welcome-title"><span>Welcome to</span><span>Ming — Every done comes with proof</span></h1>
        <div className="welcome-entry-actions"><a className="welcome-start" href="#upload"><span>Start</span><ArrowRight size={20} weight="bold" aria-hidden="true" /></a><a className="welcome-recorded-link" href="#trial">Try a guided sample <ArrowRight size={15} aria-hidden="true" /></a></div>
        <p className="welcome-intro">From “AI says it’s done”<br />to “I saw it pass.”</p>
      </section>
      <div className="welcome-stage-frame">
        <div className={`welcome-stage ${ready ? "is-ready" : ""}`} aria-hidden="true">
          <div className="welcome-door-glow" />
          <div className={`welcome-fix-area ${scene.visitor.verdict === "needs-fix" && scene.phase === "exit" ? "is-active" : ""}`}><span>FIX &amp; RETURN</span></div>
          {scene.actors.map((actor, index) => <div key={actor.name} className={`welcome-visitor ${actor.active ? "is-active" : ""} ${actor.moving ? "is-walking" : ""}`} data-visitor={actor.name} style={{ left: `${actor.x}%`, bottom: `${actor.bottom}%`, opacity: actor.opacity, zIndex: actor.active ? 8 : 7 - index }}>
            <div className="welcome-ground-shadow" />
            <div className="welcome-sprite welcome-visitor-sprite" style={spriteStyle(actor.column, actor.row)} />
          </div>)}
          <div className={`welcome-inspector ${scene.writing ? "is-writing" : ""}`} data-sprite-frame={scene.inspectorColumn}><div className="welcome-ground-shadow" /><div className="welcome-sprite" style={spriteStyle(scene.inspectorColumn, 2)} /></div>
          <div className={`welcome-inspection-state ${scene.verdictVisible ? scene.visitor.verdict : scene.phase === "inspect" ? "checking" : "waiting"}`}>
            <span className="welcome-state-light" /><span>{scene.verdictVisible ? scene.visitor.verdict === "pass" ? "PASS" : "NEEDS FIX" : scene.phase === "inspect" ? "CHECKING…" : "NEXT, PLEASE"}</span>
          </div>
          <div className="welcome-queue-label"><span />ONE AT A TIME. EVERY DETAIL.</div>
        </div>
      </div>
      <footer className="welcome-footer"><p>Illustrated scene. Your real checks start after Start.</p><button className="welcome-motion" type="button" onClick={() => setPaused(current => !current)} aria-pressed={paused} aria-label={paused ? "Play background animation" : "Pause background animation"}>
        {paused ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />}<span>{paused ? "Play scene" : "Pause scene"}</span>
      </button></footer>
    </main>
  );
}
