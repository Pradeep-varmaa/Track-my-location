"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type L from "leaflet";
import "leaflet/dist/leaflet.css";

// ---------- Types ----------
interface LocationStats {
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  updates: number;
}

interface LogEntry {
  id: number;
  time: string;
  message: string;
}

export default function LiveLocationTracker() {
  // ---------- DOM + Leaflet object refs ----------
  // Refs (not state) because these hold mutable objects that shouldn't
  // trigger re-renders when they change.
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const accuracyCircleRef = useRef<L.Circle | null>(null);
  const pathLineRef = useRef<L.Polyline | null>(null);
  const lastLatLngRef = useRef<L.LatLng | null>(null);
  const lastHeadingRef = useRef<number>(0);
  const watchIdRef = useRef<number | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const leafletRef = useRef<typeof L | null>(null);
  const logIdRef = useRef(0);

  // ---------- React state (drives what's rendered on screen) ----------
  const [isTracking, setIsTracking] = useState(false);
  const [stats, setStats] = useState<LocationStats>({
    accuracy: null,
    heading: null,
    speed: null,
    updates: 0,
  });
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // ---------- Helpers ----------
  const addLog = useCallback((message: string) => {
    logIdRef.current += 1;
    const entry: LogEntry = {
      id: logIdRef.current,
      time: new Date().toLocaleTimeString(),
      message,
    };
    setLogs((prev) => [entry, ...prev].slice(0, 40));
  }, []);

  const bearingBetween = useCallback((a: L.LatLng, b: L.LatLng) => {
    const toRad = (d: number) => (d * Math.PI) / 180;
    const toDeg = (r: number) => (r * 180) / Math.PI;
    const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
    const x =
      Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
      Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
  }, []);

  const animateTo = useCallback(
    (fromLatLng: L.LatLng, toLatLng: L.LatLng, heading: number, duration = 1200) => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      const start = performance.now();

      const step = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // ease-in-out
        const lat = fromLatLng.lat + (toLatLng.lat - fromLatLng.lat) * eased;
        const lng = fromLatLng.lng + (toLatLng.lng - fromLatLng.lng) * eased;
        markerRef.current?.setLatLng([lat, lng]);
        if (t < 1) {
          animFrameRef.current = requestAnimationFrame(step);
        } else {
          lastLatLngRef.current = toLatLng;
        }
      };
      animFrameRef.current = requestAnimationFrame(step);

      const el = document.getElementById("carMarker");
      if (el) el.style.transform = `rotate(${heading}deg)`;
    },
    []
  );

  // ---------- Core watchPosition handler ----------
  const onPosition = useCallback(
    (pos: GeolocationPosition) => {
      const Lm = leafletRef.current;
      if (!Lm || !mapRef.current) return;

      const { latitude, longitude, accuracy, heading, speed } = pos.coords;
      const newLatLng = Lm.latLng(latitude, longitude);

      if (accuracy && accuracy > 100) {
        addLog(`Discarded low-confidence point (±${Math.round(accuracy)}m)`);
        return;
      }

      let bearing = lastHeadingRef.current;
      if (heading !== null && !Number.isNaN(heading)) {
        bearing = heading;
      } else if (lastLatLngRef.current) {
        bearing = bearingBetween(lastLatLngRef.current, newLatLng);
      }
      lastHeadingRef.current = bearing;

      if (!markerRef.current) {
        const carIcon = Lm.divIcon({
          className: "",
          html: `<div id="carMarker" style="width:26px;height:26px;transform-origin:50% 50%;transition: transform 0.3s linear;">
                   <svg viewBox="0 0 24 24" width="26" height="26">
                     <path d="M12 2 L20 20 L12 16 L4 20 Z" fill="#34d399" stroke="#0e1420" stroke-width="1"/>
                   </svg>
                 </div>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        });
        markerRef.current = Lm.marker(newLatLng, { icon: carIcon }).addTo(mapRef.current);
        accuracyCircleRef.current = Lm.circle(newLatLng, {
          radius: accuracy || 20,
          color: "#34d399",
          weight: 1,
          fillOpacity: 0.08,
        }).addTo(mapRef.current);
        lastLatLngRef.current = newLatLng;
        mapRef.current.setView(newLatLng, 17);
      } else {
        animateTo(lastLatLngRef.current!, newLatLng, bearing);
        accuracyCircleRef.current?.setLatLng(newLatLng);
        accuracyCircleRef.current?.setRadius(accuracy || 20);
        mapRef.current.panTo(newLatLng, { animate: true, duration: 1 });
      }

      pathLineRef.current?.addLatLng(newLatLng);

      setStats((prev) => ({
        accuracy: accuracy ?? null,
        heading: bearing,
        speed: speed ?? null,
        updates: prev.updates + 1,
      }));

      addLog(
        `lat ${latitude.toFixed(5)}, lng ${longitude.toFixed(5)}, ±${
          accuracy ? Math.round(accuracy) : "?"
        }m`
      );
    },
    [addLog, bearingBetween, animateTo]
  );

  const onError = useCallback(
    (err: GeolocationPositionError) => {
      addLog(`Error: ${err.message}`);
      setIsTracking(false);
    },
    [addLog]
  );

  // ---------- Map setup (runs once, client-side only) ----------
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const Lm = (await import("leaflet")).default; // dynamic import: keeps Leaflet out of the server bundle
      if (cancelled || !mapContainerRef.current || mapRef.current) return;
      leafletRef.current = Lm;

      mapRef.current = Lm.map(mapContainerRef.current, { zoomControl: true }).setView(
        [17.385, 78.4867],
        16
      );
      Lm.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(mapRef.current);

      pathLineRef.current = Lm.polyline([], { color: "#34d399", weight: 3, opacity: 0.6 }).addTo(
        mapRef.current
      );
    })();

    return () => {
      cancelled = true;
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  const startTracking = () => {
    if (!navigator.geolocation) {
      addLog("Geolocation not supported on this device/browser.");
      return;
    }
    watchIdRef.current = navigator.geolocation.watchPosition(onPosition, onError, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 10000,
    });
    setIsTracking(true);
    addLog("Tracking started.");
  };

  const stopTracking = () => {
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    setIsTracking(false);
    addLog("Tracking stopped.");
  };

  // ---------- Render ----------
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: "#0e1420",
        color: "#e5eaf2",
        fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif",
      }}
    >
      <header
        style={{
          padding: "14px 18px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid #232d40",
          background: "#151d2c",
        }}
      >
        <h1 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              display: "inline-block",
              marginRight: 6,
              background: isTracking ? "#34d399" : "#8b96ac",
            }}
          />
          Live Location <span style={{ color: "#34d399" }}>Demo</span>
        </h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={startTracking}
            disabled={isTracking}
            style={{
              background: "#34d399",
              color: "#08150f",
              border: "none",
              padding: "7px 14px",
              borderRadius: 6,
              fontWeight: 600,
              cursor: isTracking ? "not-allowed" : "pointer",
              opacity: isTracking ? 0.5 : 1,
            }}
          >
            Start Tracking
          </button>
          <button
            onClick={stopTracking}
            disabled={!isTracking}
            style={{
              background: "#f87171",
              color: "#2a0d0d",
              border: "none",
              padding: "7px 14px",
              borderRadius: 6,
              fontWeight: 600,
              cursor: !isTracking ? "not-allowed" : "pointer",
              opacity: !isTracking ? 0.5 : 1,
            }}
          >
            Stop
          </button>
        </div>
      </header>

      <div ref={mapContainerRef} style={{ flex: 1, minHeight: 0 }} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 1,
          background: "#232d40",
          borderTop: "1px solid #232d40",
        }}
      >
        <Stat label="Accuracy" value={stats.accuracy ? `±${Math.round(stats.accuracy)}m` : "—"} />
        <Stat label="Heading" value={stats.heading !== null ? `${Math.round(stats.heading)}°` : "—"} />
        <Stat label="Speed" value={stats.speed ? `${(stats.speed * 3.6).toFixed(1)} km/h` : "—"} />
        <Stat label="Updates" value={String(stats.updates)} />
      </div>

      <div
        style={{
          maxHeight: 90,
          overflowY: "auto",
          background: "#0a0f18",
          fontSize: 11,
          color: "#8b96ac",
          padding: "6px 14px",
          borderTop: "1px solid #232d40",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        }}
      >
        {logs.map((l) => (
          <div key={l.id}>
            [{l.time}] {l.message}
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "#151d2c", padding: "10px 14px" }}>
      <div
        style={{
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: 0.6,
          color: "#8b96ac",
          marginBottom: 3,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 15, fontWeight: 600 }}>{value}</div>
    </div>
  );
}