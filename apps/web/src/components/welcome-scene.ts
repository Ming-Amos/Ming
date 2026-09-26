export const welcomeVisitors = [
  { name: 'Duck', column: 0, row: 0, verdict: 'pass' },
  { name: 'Flame', column: 1, row: 0, verdict: 'needs-fix' },
  { name: 'Stone', column: 2, row: 0, verdict: 'pass' },
  { name: 'Sprout', column: 3, row: 0, verdict: 'needs-fix' },
  { name: 'Cubes', column: 0, row: 1, verdict: 'pass' },
  { name: 'Panda', column: 1, row: 1, verdict: 'pass' },
  { name: 'Orb', column: 2, row: 1, verdict: 'needs-fix' },
] as const;
export const welcomeCycleMs = 8500;
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const ease = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t); };

/** Pure illustrative timeline. This never represents an actual acceptance run. */
export function welcomeSceneAt(elapsed: number) {
  const turn = Math.floor(Math.max(0, elapsed) / welcomeCycleMs);
  const time = Math.max(0, elapsed) % welcomeCycleMs;
  const active = turn % welcomeVisitors.length;
  const visitor = welcomeVisitors[active];
  const phase = time < 2200 ? 'approach' : time < 4300 ? 'inspect' : time < 5600 ? 'verdict' : time < 7900 ? 'exit' : 'handoff';
  const departing = ease((time - 5600) / 2300), isPass = visitor.verdict === 'pass';
  const activeX = phase === 'approach' ? 45 + 22 * ease(time / 2200) : 67 + (isPass ? 26 : -15) * departing;
  const activeBottom = 20 + (isPass ? 8 : -19) * departing;
  const activeOpacity = time < 7300 ? 1 : 1 - ease((time - 7300) / 600);
  const writing = phase === 'inspect' || phase === 'verdict' && time < 4700;
  return { active, visitor, phase, time, writing, inspectorColumn: writing ? 1 + Math.floor(time / 140) % 2 : 0,
    verdictVisible: time >= 4300 && time < 7300,
    actors: welcomeVisitors.map((actor, index) => {
      const rank = (index - active + welcomeVisitors.length) % welcomeVisitors.length;
      return { ...actor, active: index === active, x: index === active ? activeX : 52 - rank * 7 - 7 * (1 - ease(time / 1100)),
        bottom: index === active ? activeBottom : 20, opacity: index === active ? activeOpacity : rank === 6 && turn > 0 ? ease(time / 700) : 1,
        moving: index === active ? phase === 'approach' || phase === 'exit' : time < 1100 };
    }) };
}
