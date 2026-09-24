'use client';
/* eslint-disable @next/next/no-img-element -- spot cards use local catalog image assets */

import { getSpeciesImage } from '@/lib/scoring/speciesAdvisor';
import { SPECIES } from '@/lib/speciesCatalog';
import { distanceMiles } from '@/lib/nearbySpots';
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

interface UserLocation {
  lat: number;
  lng: number;
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
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [selectedSpecies, setSelectedSpecies] = useState(SPECIES[0]?.name ?? '');

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
            spots: typeof lat === 'number' && typeof lng === 'number'
              ? spots
                  .filter((spot) => distanceMiles({ latitude: lat, longitude: lng }, { latitude: spot.lat, longitude: spot.lng }) <= 25)
                  .sort((a, b) => b.lat - a.lat)
                  .slice(0, 10)
              : [],
            species: selectedSpecies,
            userLat: lat,
            userLng: lng,
          }),
        });

        const data: unknown = await response.json();

        if (!response.ok) {
          const message =
            data &&
            typeof data === 'object' &&
            'error' in data &&
            typeof data.error === 'string'
              ? data.error
              : 'Failed to find fishing spots';

          throw new Error(message);
        }

        const responseData = data as {
          results?: RankedSpot[];
          total_nearby?: number;
        };

        setResults(Array.isArray(responseData.results) ? responseData.results : []);
        setTotalNearby(
          typeof responseData.total_nearby === 'number'
            ? responseData.total_nearby
            : null,
        );
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
    [selectedSpecies, spots],
  );

  const saveLocation = (lat: number, lng: number): UserLocation => {
    const location = { lat, lng };
    setUserLocation(location);

    return location;
  };

  const handleFind = () => {
    setLocating(true);

    if (!navigator.geolocation) {
      setLocating(false);
      void runSuggestion();

      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = saveLocation(
          position.coords.latitude,
          position.coords.longitude,
        );

        setLocating(false);
        void runSuggestion(location.lat, location.lng);
      },
      () => {
        setLocating(false);
        void runSuggestion();
      },
      {
        enableHighAccuracy: false,
        timeout: 6000,
        maximumAge: 900000,
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
            margin: 0,
            color: '#cbd5e1',
            fontSize: '14px',
            lineHeight: 1.5,
          }}
        >
          Find nearby Oklahoma waters with AI-generated trip ideas based on the selected spot metadata. Verify live conditions before traveling.
        </p>
      </div>

      <label htmlFor="trip-target-species" style={{ display: 'block', marginBottom: '12px', color: '#cbd5e1', fontSize: '12px', fontWeight: 700 }}>
        Target species
        <select
          id="trip-target-species"
          value={selectedSpecies}
          onChange={(event) => setSelectedSpecies(event.target.value)}
          style={{ display: 'block', width: '100%', marginTop: '6px', border: '1px solid #294452', borderRadius: '8px', padding: '10px 12px', color: '#e2e8f0', background: '#0d1c29', fontSize: '14px' }}
        >
          {SPECIES.map((species) => <option key={species.id} value={species.name}>{species.name}</option>)}
        </select>
        <span style={{ display: 'block', marginTop: '5px', color: '#78909c', fontSize: '11px', fontWeight: 400 }}>AI results are estimates, not provider conditions or catch reports. Only the top 10 spots within 25 miles of your device will be shown.</span>
      </label>

      <button
        type="button"
        onClick={handleFind}
        disabled={loading || locating}
        style={{
          width: '100%',
          border: 0,
          borderRadius: '10px',
          padding: '12px 16px',
          fontSize: '15px',
          fontWeight: 700,
          color: '#06202b',
          background: loading || locating ? '#94a3b8' : '#22d3ee',
          cursor: loading || locating ? 'not-allowed' : 'pointer',
        }}
      >
        {locating
          ? 'Getting your location...'
          : loading
            ? 'Finding the best spots...'
            : 'Find Fishing Spots Near Me'}
      </button>

      {userLocation ? (
        <p
          style={{
            margin: '10px 0 0',
            color: '#94a3b8',
            fontSize: '12px',
          }}
        >
          Using location: {userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)}
        </p>
      ) : null}

      {error ? (
        <p
          role="alert"
          style={{
            margin: '16px 0 0',
            borderRadius: '8px',
            padding: '10px 12px',
            color: '#fecaca',
            background: '#7f1d1d',
            fontSize: '14px',
          }}
        >
          {error}
        </p>
      ) : null}

      {totalNearby !== null ? (
        <p
          style={{
            margin: '16px 0 8px',
            color: '#cbd5e1',
            fontSize: '13px',
          }}
        >
          {totalNearby} nearby {totalNearby === 1 ? 'spot' : 'spots'} evaluated
        </p>
      ) : null}

      <div
        style={{
          display: 'grid',
          gap: '12px',
          marginTop: results.length > 0 ? '16px' : 0,
        }}
      >
        {results.map((spot) => (
          <article
            key={
              spot.spot_id ??
              `${spot.spot_name}-${spot.spot_lat ?? 'unknown'}-${spot.spot_lng ?? 'unknown'}`
            }
            style={{
              overflow: 'hidden',
              border: '1px solid #334155',
              borderRadius: '12px',
              background: '#0f172a',
            }}
          >
            {spot.primary_species[0] ? (() => {
              const speciesImage = getSpeciesImage(spot.primary_species[0]);
              return speciesImage ? (
                <img
                  src={speciesImage}
                  alt={`${spot.primary_species[0]} reference image`}
                  style={{
                    display: 'block',
                    width: '100%',
                    height: '150px',
                    objectFit: 'cover',
                    background: '#1e293b',
                  }}
                />
              ) : (
                <div style={{ padding: '12px 14px', color: '#94a3b8', fontSize: 11, background: '#1e293b' }}>
                  No verified image is available for {spot.primary_species[0]}.
                </div>
              );
            })() : null}

            <div style={{ padding: '14px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '12px',
                }}
              >
                <div>
                  <h3
                    style={{
                      margin: 0,
                      color: 'white',
                      fontSize: '16px',
                    }}
                  >
                    {spot.spot_name}
                  </h3>
                  {spot.miles_away !== null ? (
                    <p
                      style={{
                        margin: '4px 0 0',
                        color: '#94a3b8',
                        fontSize: '13px',
                      }}
                    >
                      {spot.miles_away.toFixed(1)} miles away
                    </p>
                  ) : null}
                </div>

                <span
                  style={{
                    flexShrink: 0,
                    borderRadius: '999px',
                    padding: '4px 8px',
                    color: '#020617',
                    background: ratingColor(spot.rating),
                    fontSize: '12px',
                    fontWeight: 800,
                  }}
                >
                  {spot.rating}
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginTop: '12px',
                }}
              >
                <div
                  aria-label={`Fishing score: ${spot.fishing_score}`}
                  style={{
                    height: '8px',
                    flex: 1,
                    overflow: 'hidden',
                    borderRadius: '999px',
                    background: '#334155',
                  }}
                >
                  <div
                    style={{
                      width: `${Math.max(0, Math.min(100, spot.fishing_score))}%`,
                      height: '100%',
                      background: scoreColor(spot.fishing_score),
                    }}
                  />
                </div>

                <span
                  style={{
                    color: scoreColor(spot.fishing_score),
                    fontSize: '13px',
                    fontWeight: 800,
                  }}
                >
                  {spot.fishing_score}/100
                </span>
              </div>

              {spot.primary_species.length > 0 ? (
                <p
                  style={{
                    margin: '12px 0 0',
                    color: '#e2e8f0',
                    fontSize: '14px',
                  }}
                >
                  <strong>Target species:</strong> {spot.primary_species.join(', ')}
                </p>
              ) : null}

              <p
                style={{
                  margin: '8px 0 0',
                  color: '#cbd5e1',
                  fontSize: '14px',
                  lineHeight: 1.5,
                }}
              >
                {spot.reason}
              </p>

              <div
                style={{
                  display: 'grid',
                  gap: '6px',
                  marginTop: '12px',
                  color: '#cbd5e1',
                  fontSize: '13px',
                }}
              >
                <div>
                  <strong>Best time:</strong> {spot.best_time_today}
                </div>
                <div>
                  <strong>Technique:</strong> {spot.best_technique}
                </div>
                <div>
                  <strong>Recommended lure:</strong> {spot.recommended_lure}
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
