import { useEffect, useRef } from 'react';
import { useBitePredictions } from '@/hooks/useBitePredictions';
import { Coordinates } from '@/lib/region';

interface PredictiveAlertsProps {
  coordinates: Coordinates | null;
  onSpeciesSelect: (speciesId: string) => void;
}

/**
 * Area-wide bite alerts are delivered through the browser notification channel,
 * not rendered as a persistent card on every page.
 */
export default function PredictiveAlerts({ coordinates, onSpeciesSelect }: PredictiveAlertsProps) {
  const { predictions, isLoading } = useBitePredictions(coordinates);
  const notifiedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (isLoading || typeof window === 'undefined' || !('Notification' in window)) return;
    const primePredictions = predictions.filter((prediction) => prediction.isPrime);
    if (primePredictions.length === 0) return;

    const sendNotifications = async () => {
      if (Notification.permission === 'default') {
        try {
          await Notification.requestPermission();
        } catch {
          return;
        }
      }
      if (Notification.permission !== 'granted') return;

      const areaKey = coordinates
        ? `${coordinates.latitude.toFixed(1)}:${coordinates.longitude.toFixed(1)}`
        : 'area';
      primePredictions.slice(0, 3).forEach((prediction) => {
        const notificationKey = `${areaKey}:${prediction.speciesId}`;
        if (notifiedRef.current.has(notificationKey)) return;
        notifiedRef.current.add(notificationKey);
        const notification = new Notification(`${prediction.name} is in prime bite time`, {
          body: `Current area conditions are favorable for ${prediction.name}. Open FishFinder for the best spot, bait, and timing.`,
          tag: notificationKey,
        });
        notification.onclick = () => {
          window.focus();
          onSpeciesSelect(prediction.speciesId);
          notification.close();
        };
      });
    };

    void sendNotifications();
  }, [coordinates, isLoading, onSpeciesSelect, predictions]);

  return null;
}

