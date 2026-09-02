import { useEffect, useRef, useState } from 'react';
import type { Message } from '../components/InlineMessage';

const AUTO_DISMISS_MS = 4000;

export function useAutoDismissMessage() {
  const [message, setMessageState] = useState<Message | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  function setMessage(next: Message | null) {
    clearTimeout(timerRef.current);
    setMessageState(next);
    if (next) {
      timerRef.current = setTimeout(() => setMessageState(null), AUTO_DISMISS_MS);
    }
  }

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return [message, setMessage] as const;
}
