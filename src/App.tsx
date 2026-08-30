import FishingMap from "./components/FishingMap";

export default function App() {
  return (
    <div className="app">
      <header className="top-bar">
        <strong>FishFinder Pro</strong>
      </header>

      <FishingMap />

      <section className="map-overlay">
        <h3>Top bite zones</h3>
        <p>Loading live scoring...</p>
      </section>

      <nav className="bottom-nav">
        Map · Logbook · AI · Top Spots · Settings
      </nav>
    </div>
  );
}
