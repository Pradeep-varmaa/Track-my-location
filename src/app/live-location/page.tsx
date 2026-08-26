"use client";
export const dynamic = "force-dynamic";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import geohash from 'ngeohash'

type LatLng = [number, number];

export default function Page() {
  
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div
        style={{
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        Loading map…
      </div>
    );
  }

  return <LiveLocationMap />;
}

// Everything below this line only ever executes client-side, because
// <LiveLocationMap /> is never rendered until `mounted` is true above.
function LiveLocationMap() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const {
    MapContainer,
    TileLayer,
    Marker,
    Popup,
    useMap,
  } = require("react-leaflet");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const L = require("leaflet");

  const [displayPos, setDisplayPos] = useState<LatLng | null>(null);
  const currentRef = useRef<LatLng | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [hash, sethash] = useState("")

  const carIcon = new L.Icon({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    iconRetinaUrl:
      "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
  });

  function FollowMarker({ position }: { position: LatLng }) {
    const map = useMap();
    useEffect(() => {
      map.panTo(position, { animate: true, duration: 1 });
    }, [position, map]);
    return null;
  }

  const animate = (from: LatLng, to: LatLng, duration = 1500) => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    const start = performance.now();

    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      const lat = from[0] + (to[0] - from[0]) * eased;
      const lng = from[1] + (to[1] - from[1]) * eased;
      currentRef.current = [lat, lng];
      setDisplayPos([lat, lng]);
      if (t < 1) animFrameRef.current = requestAnimationFrame(step);
    };
    animFrameRef.current = requestAnimationFrame(step);
  };

  useEffect(() => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const newPos: LatLng = [latitude, longitude];
        setAccuracy(accuracy);

        if (!currentRef.current) {
          currentRef.current = newPos;
          setDisplayPos(newPos);
          const hashed = geohash.encode(newPos[0], newPos[1])
          sethash(hashed)
        } else {
          animate(currentRef.current, newPos);
          const hashed = geohash.encode(newPos[0], newPos[1])
          sethash(hashed)

        }
      },
      (err) => console.error(err.message),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 },
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  if (!displayPos) {
    return <div>Getting your location…</div>;
  }

  return (
    <div style={{ height: "100vh", width: "100%"}}>
      <div style={{ height: "90vh", width: "100%", padding: "10px" , margin:"auto"}}>
        <MapContainer
          center={displayPos}
          zoom={17}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
          />
          <Marker position={displayPos} icon={carIcon}>
            <Popup>
              Lat: {displayPos[0].toFixed(6)}, Lng: {displayPos[1].toFixed(6)}
              {accuracy && (
                <>
                  <br />±{Math.round(accuracy)}m
                </>
              )}
            </Popup>
          </Marker>
          <FollowMarker position={displayPos} />
        </MapContainer>
      </div>

      <p>{displayPos[0]} , {displayPos[1]}</p>
      <p>{hash}</p>
    </div>
  );
}
