import { useEffect } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "../styles/app.css";

function MapResizer() {
  const map = useMap();

  useEffect(() => {
    const resize = () => map.invalidateSize();

    const el = map.getContainer();
    const ro = new ResizeObserver(() => resize());
    ro.observe(el);

    const t1 = window.setTimeout(resize, 150);
    const t2 = window.setTimeout(resize, 500);

    window.addEventListener("resize", resize);

    return () => {
      ro.disconnect();
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener("resize", resize);
    };
  }, [map]);

  return null;
}

export default function FishingMap() {
  return (
    <div className="map-shell">
      <MapContainer
        center={[35.3334, -97.3736]}
        zoom={11}
        scrollWheelZoom={true}
        zoomControl={false}
        attributionControl={false}
        className="map-canvas"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapResizer />
      </MapContainer>

      <div className="map-cinematic-glow" aria-hidden="true" />
      <div className="map-cinematic-vignette" aria-hidden="true" />
    </div>
  );
}
