'use client';
/* eslint-disable @next/next/no-img-element -- spot cards use local catalog image assets */

import { getSpeciesImage } from '@/lib/scoring/speciesAdvisor';
import { useCallback, useState } from 'react';

interface Spot {
  id: string;
  name: string;
  lat: number;
  lng: number;
  water_type: string;
  spot_type: string;
}

interface RankedSpot {
  spot_id: string | null;
  spot_name: string;
  spot_lat: number | null;
  spot_lng: number | null;
  miles_away: number | null;
  fishing_score: number;
  rating: string;
  primary_species: string[];
  best_technique: string;
  best_time_today: string;
  recommended_lure: string;
  reason: string;
}

interface Props {
  spots: Spot[];
}

const ratingColor = (rating: string) =>
  rating === 'Hot'
    ? '#22c55e'
    : rating === 'Good'
      ? '#eab308'
      : '#f97316';

const scoreColor = (score: number) =>
  score >= 75
    ? '#22c55e'
    : score >= 50
      ? '#eab308'
      : score >= 30
        ? '#f97316'
        : '#6b7280';

export default function SpotSuggester({ spots }: Props) {
  const [results, setResults] = useState<RankedSpot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalNearby, setTotalNearby] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  const runSuggestion = useCallback(
    async (lat?: number, lng?: number) => {
      setLoading(true);
      setError(null);
      setResults([]);

      try {
        const response = await fetch('/api/ai/suggest-spots', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            spots,
            userLat: lat,
            userLng: lng,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to find fishing spots');
        }

        setResults(data.results ?? []);
        setTotalNearby(data.total_nearby ?? null);
      } catch (requestError: unknown) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'AI spot recommendations are unavailable',
        );
      } finally {
        setLoading(false);
      }
    },
    [spots],
  );

  const handleFind = () => {
    setLocating(true);

    if (!navigator.geolocation) {
      setLocating(false);
      runSuggestion();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };

        setUserLocation(location);
        setLocating(false);
        runSuggestion(location.lat, location.lng);
      },
      () => {
        setLocating(false);
        runSuggestion();
      },
      {
        timeout: 6000,
        maximumAge: 60000,
      },
    );
  };

  return (
    <div
      style={{
        padding: '16px',
        color: 'white',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div style={{ marginBottom: '16px' }}>
        <div
          style={{
            fontSize: '16px',
            fontWeight: 'bold',
            color: '#22d3ee',
            marginBottom: '4px',
          }}
        >
          🎯 AI Spot Finder
        </div>
        <p
          style={{
            fontSize: '11px',
            color: '#64748b',
            margin: 0,
          }}
        >
          Every recommended spot includes a bite window, technique, bait, and
          target species.
        </p>
      </div>

      {userLocation && (
        <div
          style={{
            background: '#0c2a1a',
            border: '1px solid #166534',
            borderRadius: '8px',
            padding: '8px 12px',
            marginBottom: '12px',
            fontSize: '10px',
            color: '#4ade80',
          }}
        >
          📍 Using your location · {userLocation.lat.toFixed(3)},{' '}
          {userLocation.lng.toFixed(3)}
          {totalNearby !== null &&
            ` · ${totalNearby} spots considered`}
        </div>
      )}

      {!loading && (
        <button
          onClick={handleFind}
          disabled={locating}
          style={{
            width: '100%',
            background: 'linear-gradient(135deg,#0369a1,#7c3aed)',
            color: 'white',
            border: 'none',
            padding: '14px',
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: 'bold',
            cursor: locating ? 'default' : 'pointer',
            marginBottom: '16px',
            opacity: locating ? 0.7 : 1,
          }}
        >
          {locating
            ? '📡 Getting your location...'
            : results.length > 0
              ? '↻ Find Again'
              : '🎯 Find Best Spots Near Me'}
        </button>
      )}

      {loading && (
        <div
          style={{
            background: '#0f172a',
            borderRadius: '12px',
            padding: '24px',
            textAlign: 'center',
            marginBottom: '16px',
          }}
        >
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>🧠</div>
          <p
            style={{
              color: '#38bdf8',
              fontWeight: 'bold',
              fontSize: '13px',
              margin: '0 0 4px',
            }}
          >
            AI analyzing nearby spots...
          </p>
          <p
            style={{
              color: '#475569',
              fontSize: '11px',
              margin: 0,
            }}
          >
            Ranking spots and preparing time-window and technique plans
          </p>
        </div>
      )}

      {error && !loading && (
        <div
          style={{
            background: '#450a0a',
            border: '1px solid #7f1d1d',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '12px',
          }}
        >
          <p
            style={{
              color: '#fca5a5',
              fontSize: '12px',
              margin: 0,
            }}
          >
            ⚠ {error}
          </p>
        </div>
      )}

      {results.length > 0 &&
        !loading &&
        results.map((result, index) => (
          <div
            key={result.spot_id ?? `${result.spot_name}-${index}`}
            style={{
              background: '#0a0f1e',
              border: `1px solid ${ratingColor(result.rating)}33`,
              borderRadius: '12px',
              padding: '12px',
              marginBottom: '10px',
              borderLeft: `4px solid ${ratingColor(result.rating)}`,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '8px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <div
                  style={{
                    background: ratingColor(result.rating),
                    color: 'black',
                    fontWeight: 'bold',
                    fontSize: '13px',
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {index + 1}
                </div>

                <div>
                  <div
                    style={{
                      fontSize: '13px',
                      fontWeight: 'bold',
                      color: '#e2e8f0',
                    }}
                  >
                    {result.spot_name}
                  </div>

                  {result.miles_away !== null && (
                    <div
                      style={{
                        fontSize: '10px',
                        color: '#64748b',
                      }}
                    >
                      📍 {result.miles_away} miles away
                    </div>
                  )}
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div
                  style={{
                    fontSize: '20px',
                    fontWeight: 'bold',
                    color: scoreColor(result.fishing_score),
                  }}
                >
                  {result.fishing_score}
                </div>
                <div
                  style={{
                    fontSize: '8px',
                    color: ratingColor(result.rating),
                    fontWeight: 'bold',
                  }}
                >
                  {result.rating.toUpperCase()}
                </div>
              </div>
            </div>

            <p
              style={{
                fontSize: '11px',
                color: '#94a3b8',
                margin: '0 0 8px',
                lineHeight: 1.4,
              }}
            >
              {result.reason}
            </p>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '6px',
                marginBottom: '6px',
              }}
            >
              <div
                style={{
                  background: '#0f172a',
                  borderRadius: '6px',
                  padding: '7px',
                }}
              >
                <div
                  style={{
                    fontSize: '8px',
                    color: '#475569',
                    marginBottom: '2px',
                  }}
                >
                  ⏰ BEST WINDOW
                </div>
                <div
                  style={{
                    fontSize: '10px',
                    color: '#fbbf24',
                    fontWeight: 'bold',
                  }}
                >
                  {result.best_time_today}
                </div>
              </div>

              <div
                style={{
                  background: '#0f172a',
                  borderRadius: '6px',
                  padding: '7px',
                }}
              >
                <div
                  style={{
                    fontSize: '8px',
                    color: '#475569',
                    marginBottom: '2px',
                  }}
                >
                  🎣 TECHNIQUE
                </div>
                <div
                  style={{
                    fontSize: '9px',
                    color: '#cbd5e1',
                    lineHeight: 1.35,
                  }}
                >
                  {result.best_technique}
                </div>
              </div>
            </div>

            <div
              style={{
                background: '#0f172a',
                borderRadius: '6px',
                padding: '7px',
                marginBottom:
                  result.primary_species?.length > 0 ? '8px' : 0,
              }}
            >
              <div
                style={{
                  fontSize: '8px',
                  color: '#475569',
                  marginBottom: '2px',
                }}
              >
                🪱 BAIT / LURE
              </div>
              <div
                style={{
                  fontSize: '9px',
                  color: '#cbd5e1',
                  lineHeight: 1.35,
                }}
              >
                {result.recommended_lure}
              </div>
            </div>

            {result.primary_species?.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '4px',
                }}
              >
                {result.primary_species.map((species, speciesIndex) => (
                  <span
                    key={`${species}-${speciesIndex}`}
                    style={{
                      background: '#0f3460',
                      color: '#93c5fd',
                      fontSize: '9px',
                      padding: '2px 7px',
                      borderRadius: '10px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <img
                      src={getSpeciesImage(species)}
                      alt={species}
                      style={{
                        width: '14px',
                        height: '14px',
                        objectFit: 'cover',
                        borderRadius: '50%',
                      }}
                    />
                    {species}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}

      {results.length === 0 && !loading && !error && (
        <div
          style={{
            background: '#0a0f1e',
            border: '1px dashed #1e293b',
            borderRadius: '12px',
            padding: '24px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '36px', marginBottom: '8px' }}>🗺️</div>
          <p
            style={{
              color: '#475569',
              fontSize: '12px',
              margin: 0,
            }}
          >
            Tap the button above to rank nearby fishing spots and receive a
            bite window, technique, lure, and target-species plan for each
            location.
          </p>
        </div>
      )}
    </div>
  );
}
