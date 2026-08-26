// 'use client'

// import "leaflet/dist/leaflet.css";
// import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
// import { useEffect, useState } from "react";

// export default function Livelocation() {

//     const [position, setPosition] = useState<[number, number] | null>(null);
//   useEffect(() => {
//     if (!navigator.geolocation) {
//       alert("Geolocation is not supported by your browser");
//     }

//     navigator.geolocation.watchPosition((position) => {
//       const { latitude, longitude } = position.coords;
//       console.log(`Latitude: ${latitude}, Longitude: ${longitude}`);
//       setPosition([latitude, longitude])
//     });
//   }, []);

//   return <div>{position ? `Latitude: ${position[0]}, Longitude: ${position[1]}` : "Location not available"
  
//   }</div>;
// }



'use client'

import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { useEffect, useRef, useState } from "react";
import L from "leaflet";

type LatLng = [number, number];

// Small helper: MapContainer's `center` prop only sets the initial view.
// This component re-pans the map whenever `position` changes.
function FollowMarker({ position }: { position: LatLng }) {
  const map = useMap();
  useEffect(() => {
    map.panTo(position, { animate: true, duration: 1 });
  }, [position, map]);
  return null;
}

// Custom icon (default Leaflet marker icon breaks in Next.js bundling)
const carIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

export default function LiveLocation() {
  const [displayPos, setDisplayPos] = useState<LatLng | null>(null); // smoothed value shown on map
  const currentRef = useRef<LatLng | null>(null); // current animated position
  const animFrameRef = useRef<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);

  const animate = (from: LatLng, to: LatLng, duration = 1500) => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    const start = performance.now();

    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // ease-in-out

      const lat = from[0] + (to[0] - from[0]) * eased;
      const lng = from[1] + (to[1] - from[1]) * eased;

      currentRef.current = [lat, lng];
      setDisplayPos([lat, lng]);

      if (t < 1) {
        animFrameRef.current = requestAnimationFrame(step);
      }
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
          // first fix — no previous point to animate from, just set it
          currentRef.current = newPos;
          setDisplayPos(newPos);
        } else {
          animate(currentRef.current, newPos);
        }
      },
      (err) => console.error(err.message),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
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
    <div style={{ height: "100vh", width: "100%" }}>
      <MapContainer center={displayPos} zoom={17} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />
        <Marker position={displayPos} icon={carIcon}>
          <Popup>
            Lat: {displayPos[0].toFixed(6)}, Lng: {displayPos[1].toFixed(6)}
            {accuracy && <><br />±{Math.round(accuracy)}m</>}
          </Popup>
        </Marker>
        <FollowMarker position={displayPos} />
      </MapContainer>
    </div>
  );
}