import { useEffect, useRef, useState } from "react";
import { ArrowElbowDownLeft, MagnifyingGlass } from "@phosphor-icons/react";
import Sheet from "./Sheet";
export type WorkspaceCommand = { label: string; detail: string; action: () => void; disabled?: boolean };
export default function CommandMenu({ commands, onClose }: { commands: WorkspaceCommand[]; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const filtered = commands.filter(c => !c.disabled && `${c.label} ${c.detail}`.toLowerCase().includes(query.toLowerCase()));
  useEffect(() => { input.current?.focus(); }, []);
  return <Sheet title="Jump to anything" onClose={onClose}>
    <div className="command-search"><MagnifyingGlass size={20} /><input ref={input} role="combobox" aria-expanded="true" aria-controls="ming-command-list" aria-activedescendant={filtered[index] ? `ming-command-${index}` : undefined} aria-label="Search workspace commands" placeholder="Where would you like to go?" value={query} onChange={e => {setQuery(e.target.value);setIndex(0);}} onKeyDown={e => {
      if (e.key === "ArrowDown") {e.preventDefault();setIndex(i => Math.min(i + 1, filtered.length - 1));}
      if (e.key === "ArrowUp") {e.preventDefault();setIndex(i => Math.max(0, i - 1));}
      if (e.key === "Enter" && filtered[index]) {e.preventDefault();filtered[index].action();}
    }} /></div>
    <div id="ming-command-list" role="listbox" aria-label="Workspace commands" className="command-results">{filtered.map((c, i) => <button id={`ming-command-${i}`} role="option" aria-selected={index === i} key={c.label} className={index === i ? "selected" : ""} onMouseEnter={() => setIndex(i)} onClick={c.action}><span><strong>{c.label}</strong><small>{c.detail}</small></span><ArrowElbowDownLeft size={19} /></button>)}</div>
    {!filtered.length && <p className="sheet-lead">No matching command. Try “projects”, “history” or “model”.</p>}
    <p className="command-hint">Arrow keys to navigate · Enter to open · Esc to close</p>
  </Sheet>;
}
