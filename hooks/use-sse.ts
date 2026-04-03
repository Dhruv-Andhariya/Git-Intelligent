'use client';

import { useState, useEffect } from 'react';

export function useSSE(url: string | null) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!url) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setText('');
    setLoading(true);
    setError(null);

    const eventSource = new EventSource(url);

    eventSource.onmessage = (event) => {
      if (event.data === '[DONE]') {
        setLoading(false);
        eventSource.close();
        return;
      }

      try {
        const parsed = JSON.parse(event.data);
        if (parsed.error) {
          setError(parsed.error);
          setLoading(false);
          eventSource.close();
        } else if (parsed.text) {
          setText((prev) => prev + parsed.text);
        }
      } catch (e) {
        console.error('Failed to parse SSE message', e);
      }
    };

    eventSource.onerror = (err) => {
      console.error('EventSource error:', err);
      setError('Connection lost or failed to stream.');
      setLoading(false);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [url]);

  return { text, loading, error };
}
