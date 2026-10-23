"use client";
import { useEffect, useRef, useState } from "react";
import { X, AlertCircle } from "lucide-react";
type Request = {
  title: string;
  initial?: string;
  mode: "confirm" | "text";
  resolve: (value: string | null) => void;
};
let show: ((request: Request) => void) | undefined;
const waiting: Request[] = [];
function enqueue(request: Request) {
  waiting.push(request);
  flush();
}
function flush() {
  if (show && waiting.length) show(waiting.shift()!);
}
export function confirmAction(title: string) {
  return new Promise<boolean>((resolve) =>
    enqueue({
      title,
      mode: "confirm",
      resolve: (value) => resolve(value === "yes"),
    }),
  );
}
export function requestText(title: string, initial = "") {
  return new Promise<string | null>((resolve) =>
    enqueue({ title, mode: "text", initial, resolve }),
  );
}
export function DialogHost() {
  const [request, setRequest] = useState<Request | null>(null),
    [text, setText] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const current = useRef<Request | null>(null);
  useEffect(() => {
    show = (r) => {
      if (current.current) {
        waiting.unshift(r);
        return;
      }
      current.current = r;
      setText(r.initial || "");
      setRequest(r);
    };
    flush();
    return () => {
      show = undefined;
      current.current?.resolve(null);
    };
  }, []);
  useEffect(() => {
    if (!request) return;
    const previous = document.activeElement as HTMLElement | null;
    const element = dialog.current;
    element?.showModal();
    return () => {
      element?.close();
      previous?.focus();
    };
  }, [request]);
  function close(value: string | null) {
    request?.resolve(value);
    current.current = null;
    setRequest(null);
    setTimeout(flush, 0);
  }
  return request ? (
    <dialog
      className="interaction-dialog"
      ref={dialog}
      aria-labelledby="dialog-title"
      aria-describedby="dialog-description"
      onCancel={(e) => {
        e.preventDefault();
        close(null);
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close(null);
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          close(request.mode === "text" ? text : "yes");
        }}
      >
        <div className="dialog-icon">
          <AlertCircle size={22} />
        </div>
        <button
          className="icon-button dialog-close"
          type="button"
          aria-label="Close dialog"
          onClick={() => close(null)}
        >
          <X size={20} />
        </button>
        <h2 id="dialog-title">
          {request.mode === "confirm"
            ? "Confirm your action"
            : "A little more information"}
        </h2>
        <p id="dialog-description">{request.title}</p>
        {request.mode === "text" && (
          <textarea
            id="dialog-input"
            aria-labelledby="dialog-description"
            rows={4}
            autoFocus
            value={text}
            maxLength={12000}
            onChange={(e) => setText(e.target.value)}
          />
        )}
        <div className="dialog-actions">
          <button
            type="button"
            autoFocus={request.mode === "confirm"}
            onClick={() => close(null)}
          >
            Cancel
          </button>
          <button className="button" type="submit">
            {request.mode === "text" ? "Save and continue" : "Confirm"}
          </button>
        </div>
      </form>
    </dialog>
  ) : null;
}
