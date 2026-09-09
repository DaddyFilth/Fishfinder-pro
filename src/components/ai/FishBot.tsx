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

function fallbackReply(message: string, spot: object): string {
  const question = message.toLowerCase();
  const spotData = spot as Record<string, unknown>;
  const name = typeof spotData.name === 'string' ? spotData.name : 'this water';

  if (question.includes('lure') || question.includes('bait')) {
    return `At ${name}, start with a green-pumpkin Texas-rigged worm or 3/8 oz spinnerbait around shoreline cover. If the water is stained, switch to a black-and-blue jig.`;
  }

  if (question.includes('bass')) {
    return `For bass at ${name}, work points, brush, riprap, and the first break off shallow flats. Fish shallow early and late, then move to 10–15 foot structure as the sun gets higher.`;
  }

  if (question.includes('crappie')) {
    return `Look for crappie around brush piles, dock shade, and standing timber. A 1/16 oz jig or small minnow presentation is a solid starting point.`;
  }

  if (question.includes('catfish')) {
    return `For catfish at ${name}, fish cut shad, stink bait, or punch bait near channel edges, current seams, and deeper flats close to structure.`;
  }

  return `For ${name}, begin on windblown banks and visible cover. Try moving baits first, then slow down with a jig or soft plastic around the first drop-off if bites are slow.`;
}

export default function FishBot({ spot, conditions }: Props) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const spotData = spot as Record<string, unknown>;
  const spotName = typeof spotData.name === 'string' ? spotData.name : 'this spot';

  useEffect(() => {
    let cancelled = false;

    async function loadAdvice() {
      setLoading(true);

      try {
        const res = await fetch('/api/ai/advisor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ spot, conditions }),
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
            text: `FishBot could not load a live briefing. For ${spotName}, start around cover and the first break line, then adjust depth based on water temperature and time of day.`,
            ts: new Date().toLocaleTimeString(),
          }]);
        }
      } catch {
        if (!cancelled) {
          setMessages([{
            role: 'bot',
            text: `For ${spotName}, begin around visible cover and nearby drop-offs. Low-light periods are usually your best window for active fish.`,
            ts: new Date().toLocaleTimeString(),
          }]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadAdvice();
    return () => { cancelled = true; };
  }, [spot, conditions, spotName]);

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
        body: JSON.stringify({ message: userMsg, spot, conditions }),
      });

      const data: unknown = await res.json().catch(() => ({}));
      const payload = data && typeof data === 'object' ? data as Record<string, unknown> : {};
      const reply =
        typeof payload.reply === 'string' ? payload.reply :
        typeof payload.advice === 'string' ? payload.advice :
        null;
      const error = typeof payload.error === 'string' ? payload.error : null;

      setMessages((current) => [
        ...current,
        {
          role: 'bot',
          text: reply || fallbackReply(userMsg, spot) + (error ? ` (${error})` : ''),
          ts: new Date().toLocaleTimeString(),
        },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          role: 'bot',
          text: fallbackReply(userMsg, spot),
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
