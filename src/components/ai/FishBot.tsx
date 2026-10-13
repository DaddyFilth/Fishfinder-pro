'use client';

import { useEffect, useState } from 'react';

interface Props {
  spot: object;
  conditions: object;
  compact?: boolean;
}

interface Msg {
  role: 'user' | 'bot';
  text: string;
  ts: string;
  webSearch?: boolean;
  catalogSpecies?: string[];
}

const badgeStyle: React.CSSProperties = {
  fontSize: '9px',
  fontWeight: 700,
  letterSpacing: '0.02em',
  color: '#94a3b8',
  border: '1px solid #334155',
  borderRadius: '999px',
  padding: '2px 7px',
  background: '#0f172a',
};

export default function FishBot({ spot, conditions }: Props) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const toolChoices = [
    { label: 'Bite window', prompt: 'What is the best bite window at this spot, and what uncertainty should I know?' },
    { label: 'Bait and technique', prompt: 'Recommend bait, lure presentation, and technique for this specific spot.' },
    { label: 'Current conditions', prompt: 'Summarize the supplied current conditions for this spot and tell me what is unavailable.' },
    { label: 'Safety and rules', prompt: 'What access, safety, and regulation checks should I make before fishing this spot?' },
  ];

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
  }, [spot, spotLat, spotLon, targetSpecies]);

  async function sendMessage(prompt?: string) {
    const userMsg = (prompt ?? input).trim();
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
      const catalogSpecies = Array.isArray(payload.catalog_species)
        ? payload.catalog_species.filter((entry): entry is string => typeof entry === 'string')
        : [];

      setMessages((current) => [
        ...current,
        {
          role: 'bot',
          text: reply ?? (error ? `AI provider unavailable: ${error}` : 'AI provider unavailable; no response was generated.'),
          ts: new Date().toLocaleTimeString(),
          webSearch: payload.used_web_search === true,
          catalogSpecies,
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

      <div aria-label="FishBot tools" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
        {toolChoices.map((tool) => (
          <button
            key={tool.label}
            type="button"
            onClick={() => {
              setInput(tool.prompt);
              window.setTimeout(() => void sendMessage(tool.prompt), 0);
            }}
            disabled={loading}
            style={{ border: '1px solid #155e75', borderRadius: '999px', padding: '6px 9px', background: '#0c2635', color: '#a5f3fc', fontSize: '11px', cursor: loading ? 'wait' : 'pointer' }}
          >
            {tool.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
        {messages.map((message, index) => (
          <div
            key={`${message.ts}-${index}`}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: message.role === 'user' ? 'flex-end' : 'flex-start',
              gap: '4px',
              maxWidth: '88%',
            }}
          >
            <div
              style={{
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
            {message.role === 'bot' && (message.webSearch || (message.catalogSpecies?.length ?? 0) > 0) && (
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {message.webSearch && <span style={badgeStyle}>search-derived</span>}
                {(message.catalogSpecies?.length ?? 0) > 0 && (
                  <span style={badgeStyle}>catalog: {message.catalogSpecies?.join(', ')}</span>
                )}
              </div>
            )}
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
