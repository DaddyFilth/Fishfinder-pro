'use client';
/* eslint-disable @next/next/no-img-element -- gallery renders user-uploaded data URL photos. */

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from 'react';
import type { LogbookTrip } from './LogbookTab';

const STORAGE_KEY = 'fishfinder.logbook.trips.v1';

interface GalleryPhoto {
  id: string;
  url: string;
  trip: LogbookTrip;
  photoNumber: number;
}

function loadTrips(): LogbookTrip[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) return [];

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (trip): trip is LogbookTrip =>
        Boolean(
          trip &&
            typeof trip === 'object' &&
            typeof trip.id === 'string' &&
            typeof trip.title === 'string' &&
            typeof trip.waterBody === 'string' &&
            typeof trip.date === 'string' &&
            typeof trip.species === 'string' &&
            Array.isArray(trip.photos),
        ),
    );
  } catch {
    return [];
  }
}

function formatDate(value: string): string {
  if (!value) return 'Date not recorded';

  const date = new Date(`${value}T12:00:00`);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const buttonStyle: CSSProperties = {
  border: '1px solid #334155',
  borderRadius: '999px',
  padding: '7px 11px',
  fontSize: '10px',
  fontWeight: 700,
  cursor: 'pointer',
};

export default function PhotoGalleryTab() {
  const [trips, setTrips] = useState<LogbookTrip[]>([]);
  const [selectedSpecies, setSelectedSpecies] = useState('All');
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(
    null,
  );

  useEffect(() => {
    const refreshGallery = () => setTrips(loadTrips());

    refreshGallery();

    window.addEventListener('logbook-updated', refreshGallery);
    window.addEventListener('storage', refreshGallery);

    return () => {
      window.removeEventListener('logbook-updated', refreshGallery);
      window.removeEventListener('storage', refreshGallery);
    };
  }, []);

  const allPhotos = useMemo<GalleryPhoto[]>(
    () =>
      trips
        .flatMap((trip) =>
          trip.photos
            .filter((photo): photo is string => typeof photo === 'string')
            .map((url, photoNumber) => ({
              id: `${trip.id}-${photoNumber}`,
              url,
              trip,
              photoNumber,
            })),
        )
        .sort((a, b) => {
          const aDate = new Date(a.trip.date || a.trip.createdAt).getTime();
          const bDate = new Date(b.trip.date || b.trip.createdAt).getTime();
          return bDate - aDate;
        }),
    [trips],
  );

  const speciesOptions = useMemo(
    () =>
      Array.from(
        new Set(
          allPhotos
            .map((photo) => photo.trip.species.trim())
            .filter(Boolean),
        ),
      ).sort(),
    [allPhotos],
  );

  const photos = useMemo(
    () =>
      selectedSpecies === 'All'
        ? allPhotos
        : allPhotos.filter((photo) => photo.trip.species === selectedSpecies),
    [allPhotos, selectedSpecies],
  );

  const selectedPhoto =
    selectedPhotoIndex === null ? null : photos[selectedPhotoIndex] ?? null;

  const closeViewer = () => setSelectedPhotoIndex(null);

  const showPrevious = () => {
    if (selectedPhotoIndex === null || photos.length === 0) return;

    setSelectedPhotoIndex(
      selectedPhotoIndex === 0 ? photos.length - 1 : selectedPhotoIndex - 1,
    );
  };

  const showNext = () => {
    if (selectedPhotoIndex === null || photos.length === 0) return;

    setSelectedPhotoIndex(
      selectedPhotoIndex === photos.length - 1 ? 0 : selectedPhotoIndex + 1,
    );
  };

  return (
    <div
      style={{
        height: '100%',
        overflowY: 'auto',
        padding: '16px',
        background: '#030712',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '12px',
          marginBottom: '8px',
        }}
      >
        <div>
          <div
            style={{
              fontSize: '16px',
              fontWeight: 'bold',
              color: '#22d3ee',
            }}
          >
            📸 Catch Gallery
          </div>
          <p
            style={{
              fontSize: '11px',
              color: '#64748b',
              margin: '4px 0 0',
              lineHeight: 1.4,
            }}
          >
            Your fishing photos from saved Logbook trips.
          </p>
        </div>

        <div
          style={{
            background: '#0f3460',
            color: '#93c5fd',
            borderRadius: '12px',
            padding: '5px 9px',
            fontSize: '10px',
            fontWeight: 700,
            whiteSpace: 'nowrap',
          }}
        >
          {allPhotos.length} {allPhotos.length === 1 ? 'photo' : 'photos'}
        </div>
      </div>

      {speciesOptions.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: '6px',
            overflowX: 'auto',
            padding: '10px 0 14px',
          }}
        >
          {['All', ...speciesOptions].map((species) => {
            const active = selectedSpecies === species;

            return (
              <button
                key={species}
                onClick={() => {
                  setSelectedSpecies(species);
                  setSelectedPhotoIndex(null);
                }}
                style={{
                  ...buttonStyle,
                  background: active ? '#0e7490' : '#0f172a',
                  color: active ? '#ecfeff' : '#94a3b8',
                  borderColor: active ? '#22d3ee' : '#334155',
                  flexShrink: 0,
                }}
              >
                {species === 'All' ? 'All photos' : species}
              </button>
            );
          })}
        </div>
      )}

      {photos.length === 0 ? (
        <div
          style={{
            background: '#0a0f1e',
            border: '1px dashed #334155',
            borderRadius: '14px',
            padding: '38px 20px',
            textAlign: 'center',
            marginTop: '14px',
          }}
        >
          <div style={{ fontSize: '42px', marginBottom: '10px' }}>📷</div>
          <div
            style={{
              color: '#e2e8f0',
              fontSize: '14px',
              fontWeight: 700,
              marginBottom: '6px',
            }}
          >
            No photos yet
          </div>
          <p
            style={{
              color: '#64748b',
              fontSize: '11px',
              lineHeight: 1.5,
              margin: 0,
            }}
          >
            Add fishing photos to a trip in your Logbook, and they will appear
            here automatically.
          </p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: '10px',
            paddingBottom: '84px',
          }}
        >
          {photos.map((photo, index) => (
            <button
              key={photo.id}
              onClick={() => setSelectedPhotoIndex(index)}
              style={{
                textAlign: 'left',
                background: '#0a0f1e',
                border: '1px solid #1e293b',
                borderRadius: '10px',
                padding: 0,
                overflow: 'hidden',
                cursor: 'pointer',
                color: 'white',
              }}
            >
              <img
                src={photo.url}
                alt={`${photo.trip.title} photo ${photo.photoNumber + 1}`}
                style={{
                  display: 'block',
                  width: '100%',
                  aspectRatio: '1 / 1',
                  objectFit: 'cover',
                  background: '#0f172a',
                }}
              />

              <div style={{ padding: '8px' }}>
                <div
                  style={{
                    color: '#e2e8f0',
                    fontSize: '10px',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {photo.trip.title || 'Fishing trip'}
                </div>

                <div
                  style={{
                    color: '#64748b',
                    fontSize: '9px',
                    marginTop: '3px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {photo.trip.species || 'Catch photo'} ·{' '}
                  {formatDate(photo.trip.date)}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {selectedPhoto && (
        <div
          role='dialog'
          aria-modal='true'
          aria-label='Photo viewer'
          onClick={closeViewer}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            background: 'rgba(0,0,0,0.92)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '620px',
              maxHeight: '100%',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <img
              src={selectedPhoto.url}
              alt={`${selectedPhoto.trip.title} photo ${
                selectedPhoto.photoNumber + 1
              }`}
              style={{
                display: 'block',
                width: '100%',
                maxHeight: '72dvh',
                objectFit: 'contain',
                borderRadius: '10px',
                background: '#020617',
              }}
            />

            <div
              style={{
                background: '#0a0f1e',
                border: '1px solid #1e293b',
                borderRadius: '10px',
                padding: '10px 12px',
              }}
            >
              <div
                style={{
                  color: '#e2e8f0',
                  fontSize: '13px',
                  fontWeight: 700,
                }}
              >
                {selectedPhoto.trip.title || 'Fishing trip'}
              </div>

              <div
                style={{
                  color: '#94a3b8',
                  fontSize: '10px',
                  marginTop: '4px',
                  lineHeight: 1.4,
                }}
              >
                {selectedPhoto.trip.species || 'Catch photo'} ·{' '}
                {selectedPhoto.trip.waterBody || 'Waterbody not recorded'} ·{' '}
                {formatDate(selectedPhoto.trip.date)}
              </div>

              {selectedPhoto.trip.notes && (
                <p
                  style={{
                    color: '#cbd5e1',
                    fontSize: '11px',
                    margin: '8px 0 0',
                    lineHeight: 1.4,
                  }}
                >
                  {selectedPhoto.trip.notes}
                </p>
              )}
            </div>

            <button
              onClick={closeViewer}
              aria-label='Close photo viewer'
              style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                background: 'rgba(15,23,42,0.9)',
                color: 'white',
                border: '1px solid #475569',
                borderRadius: '999px',
                width: '34px',
                height: '34px',
                cursor: 'pointer',
                fontSize: '18px',
              }}
            >
              ×
            </button>

            {photos.length > 1 && (
              <>
                <button
                  onClick={showPrevious}
                  aria-label='Previous photo'
                  style={{
                    position: 'absolute',
                    left: '8px',
                    top: '36%',
                    background: 'rgba(15,23,42,0.9)',
                    color: 'white',
                    border: '1px solid #475569',
                    borderRadius: '999px',
                    width: '38px',
                    height: '38px',
                    cursor: 'pointer',
                    fontSize: '20px',
                  }}
                >
                  ‹
                </button>

                <button
                  onClick={showNext}
                  aria-label='Next photo'
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '36%',
                    background: 'rgba(15,23,42,0.9)',
                    color: 'white',
                    border: '1px solid #475569',
                    borderRadius: '999px',
                    width: '38px',
                    height: '38px',
                    cursor: 'pointer',
                    fontSize: '20px',
                  }}
                >
                  ›
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
