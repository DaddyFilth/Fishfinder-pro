'use client';

import { useEffect, useState } from 'react';

interface Props {
  spot: object;
  conditions: object;
}

interface Msg {
  role: 'user' | 'bot';
  text: string;
  ts: string;
}

export default function FishBot({ spot, conditions }: Props) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const spotData = spot as Record<string, unknown>;
  const spotName = typeof spotData.name === 'string' ? spotData.name : 'this spot';
  const spotLat = typeof spotData.lat === 'number' ? spotData.lat : spotData.latitude;
  const spotLon = typeof (spotData.lng ?? spotData.lon ?? spotData.longitude) === 'number'
    ? (spotData.lng ?? spotData.lon ?? spotData.longitude)
    : undefined;
  const targetSpecies = typeof spotData.species === 'string' ? spotData.species : undefined;

  useEffect(() => {
    let cancelled = false;

    async function loadAdvice() {
      setLoading(true);

      try {
        const res = await fetch('/api/ai/advisor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lat: spotLat,
            lon: spotLon,
            targetSpecies,
            conditions,
          }),
        });

        const data: unknown = await res.json().catch(() => ({}));
        const payload = data && typeof data === 'object' ? data as Record<string, unknown> : {};
        const advice =
          typeof payload.advice === 'string' ? payload.advice :
          typeof payload.reply === 'string' ? payload.reply :
          null;

        if (!cancelled && advice) {
          setMessages([{ role: 'bot', text: advice, ts: new Date().toLocaleTimeString() }]);
        } else if (!cancelled) {
          setMessages([{
            role: 'bot',
            text: 'AI provider unavailable, so no briefing was generated. Check the map data source and try again when a provider is available.',
            ts: new Date().toLocaleTimeString(),
          }]);
        }
      } catch {
        if (!cancelled) {
          setMessages([{
            role: 'bot',
            text: 'AI provider unavailable, so no briefing was generated. Try again when a provider is available.',
            ts: new Date().toLocaleTimeString(),
          }]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadAdvice();
    return () => { cancelled = true; };
  }, [conditions, spot, spotLat, spotLon, spotName, targetSpecies]);

  async function sendMessage() {
    const userMsg = input.trim();
    if (!userMsg || loading) return;

    setInput('');
    setMessages((current) => [
      ...current,
      { role: 'user', text: userMsg, ts: new Date().toLocaleTimeString() },
    ]);
    setLoading(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg,
          spot,
          conditions,
          lat: typeof spotData.lat === 'number' ? spotData.lat : undefined,
          lon: typeof (spotData.lng ?? spotData.lon) === 'number' ? (spotData.lng ?? spotData.lon) as number : undefined,
          history: messages.map((message) => ({
            role: message.role === 'bot' ? 'assistant' : 'user',
            content: message.text,
          })),
        }),
      });

      const data: unknown = await res.json().catch(() => ({}));
      const payload = data && typeof data === 'object' ? data as Record<string, unknown> : {};
      const reply =
        typeof payload.reply === 'string' ? payload.reply :
        typeof payload.response === 'string' ? payload.response :
        typeof payload.advice === 'string' ? payload.advice :
        null;
      const error = typeof payload.error === 'string' ? payload.error : null;

      setMessages((current) => [
        ...current,
        {
          role: 'bot',
          text: reply ?? (error ? `AI provider unavailable: ${error}` : 'AI provider unavailable; no response was generated.'),
          ts: new Date().toLocaleTimeString(),
        },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          role: 'bot',
          text: 'AI provider unavailable; no response was generated. Please try again when a provider is available.',
          ts: new Date().toLocaleTimeString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section style={{ padding: '14px', color: '#e2e8f0' }}>
      <div style={{ marginBottom: '10px', fontWeight: 800, color: '#22d3ee' }}>
        🎣 FishBot — {spotName}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
        {messages.map((message, index) => (
          <div
            key={`${message.ts}-${index}`}
            style={{
              alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '88%',
              padding: '10px 12px',
              borderRadius: '12px',
              background: message.role === 'user' ? '#075985' : '#172033',
              fontSize: '13px',
              lineHeight: 1.45,
              whiteSpace: 'pre-wrap',
            }}
          >
            {message.text}
          </div>
        ))}
        {loading && <div style={{ color: '#94a3b8', fontSize: '12px' }}>FishBot is thinking…</div>}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void sendMessage();
        }}
        style={{ display: 'flex', gap: '8px' }}
      >
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask FishBot about bait, depth, or species…"
          style={{
            flex: 1,
            minWidth: 0,
            border: '1px solid #334155',
            borderRadius: '9px',
            padding: '10px',
            background: '#0f172a',
            color: '#f8fafc',
          }}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          style={{
            border: 'none',
            borderRadius: '9px',
            padding: '10px 14px',
            background: loading || !input.trim() ? '#334155' : '#0891b2',
            color: 'white',
            fontWeight: 700,
          }}
        >
          Send
        </button>
      </form>
    </section>
  );
}
