import { useEffect, useRef } from "react";
import { X } from "@phosphor-icons/react";

export default function Sheet({
  title,
  onClose,
  children,
  wide = false,
  locked = false,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
  locked?: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialogRef.current;
    if (element && !element.open) element.showModal();
    return () => element?.close();
  }, []);
  return (
    <dialog
      ref={dialogRef}
      aria-label={title}
      className={`sheet ${wide ? "sheet-wide" : ""}`}
      onCancel={(event) => {
        if (locked) event.preventDefault();
        else onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !locked) onClose();
      }}
    >
      <div className="sheet-heading">
        <h2>{title}</h2>
        <button
          className="icon-button"
          disabled={locked}
          onClick={onClose}
          aria-label="关闭面板"
        >
          <X size={21} />
        </button>
      </div>
      <div className="sheet-content">{children}</div>
    </dialog>
  );
}
