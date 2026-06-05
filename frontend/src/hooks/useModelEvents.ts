import { useEffect, useState } from "react";

interface VlmState {
  state: string;
  stage: string;
  progress: number;
  error: string;
}

interface Sam2State {
  state: string;
  stage: string;
  progress: number;
  error: string;
}

interface Sam3State {
  loaded: boolean;
  status: string;
}

interface ModelStates {
  vlm: VlmState;
  sam2: Sam2State;
  sam3: Sam3State;
}

const defaults: ModelStates = {
  vlm: { state: "unloaded", stage: "", progress: 0, error: "" },
  sam2: { state: "unloaded", stage: "", progress: 0, error: "" },
  sam3: { loaded: false, status: "unloaded" },
};

let cached: ModelStates = { ...defaults };
let subscribers: Array<(s: ModelStates) => void> = [];
let es: EventSource | null = null;

function connect() {
  if (es) return;
  es = new EventSource(`${API_BASE}/model/events`);
  es.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      cached = { ...defaults, ...data };
      subscribers.forEach((fn) => fn(cached));
    } catch { /* ignore */ }
  };
  es.onerror = () => {
    es?.close();
    es = null;
    // Reconnect after a delay
    setTimeout(connect, 5000);
  };
}

function subscribe(fn: (s: ModelStates) => void) {
  subscribers.push(fn);
  if (subscribers.length === 1) connect();
  fn(cached);
  return () => {
    subscribers = subscribers.filter((s) => s !== fn);
    if (subscribers.length === 0) {
      es?.close();
      es = null;
    }
  };
}

export function useModelEvents(): ModelStates {
  const [state, setState] = useState<ModelStates>(cached);
  useEffect(() => subscribe(setState), []);
  return state;
}
