import { INDIAN_PLACES, CITY_LANDMARKS, IndianPlace } from '../data/initialBarriers';
import { RoutePoint } from '../types/barrier';

/**
 * Parses raw GPS coordinate string like "12.9716, 77.5946" or "12.9716 77.5946"
 */
export function parseCoordinates(query: string): { lat: number; lng: number } | null {
  const coordRegex = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/;
  const match = query.match(coordRegex);
  if (match) {
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng };
    }
  }
  return null;
}

/**
 * Searches local Indian places and landmarks instantly with zero network latency
 */
export function searchLocalIndianPlaces(query: string): RoutePoint[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase().trim();
  const results: RoutePoint[] = [];

  // Search Landmarks
  CITY_LANDMARKS.forEach((lm) => {
    if (
      lm.name.toLowerCase().includes(q) ||
      lm.city.toLowerCase().includes(q) ||
      lm.address.toLowerCase().includes(q) ||
      lm.state.toLowerCase().includes(q)
    ) {
      results.push({
        name: lm.name,
        address: `${lm.address}, ${lm.city}, ${lm.state}`,
        lat: lm.lat,
        lng: lm.lng,
        city: lm.city,
        state: lm.state,
      });
    }
  });

  // Search Indian Places (cities, states, transit hubs)
  INDIAN_PLACES.forEach((p) => {
    if (p.name.toLowerCase().includes(q) || p.state.toLowerCase().includes(q)) {
      results.push({
        name: p.name,
        address: `${p.name}, ${p.state}`,
        lat: p.lat,
        lng: p.lng,
        city: p.name,
        state: p.state,
      });
    }
  });

  return results;
}

/**
 * Geocodes an address or place using OpenStreetMap Nominatim with India prioritization
 */
export async function geocodeNominatim(query: string): Promise<RoutePoint[]> {
  if (!query.trim() || query.length < 2) return [];

  // 1. Direct coordinate check
  const coords = parseCoordinates(query);
  if (coords) {
    return [
      {
        name: `GPS (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`,
        address: `Latitude: ${coords.lat.toFixed(5)}, Longitude: ${coords.lng.toFixed(5)}`,
        lat: coords.lat,
        lng: coords.lng,
        isCustom: true,
      },
    ];
  }

  // 2. Fetch from Nominatim API with timeout
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        query
      )}&countrycodes=in&limit=6&addressdetails=1`,
      {
        signal: controller.signal,
        headers: {
          'User-Agent': 'ACCESSVERSE-Accessibility-Platform/1.0',
          'Accept-Language': 'en',
        },
      }
    );
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data.map((item: any) => {
          const parts = item.display_name.split(',');
          const name = parts[0]?.trim() || query;
          const city =
            item.address?.city ||
            item.address?.town ||
            item.address?.village ||
            item.address?.district ||
            item.address?.state_district ||
            '';
          const state = item.address?.state || '';

          return {
            name,
            address: item.display_name,
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
            city,
            state,
            isCustom: true,
          };
        });
      }
    }
  } catch (err) {
    console.warn('[Geocoding] Nominatim fetch fallback:', err);
  }

  return [];
}

/**
 * Reverse geocodes coordinates into an Indian address
 */
export async function reverseGeocode(lat: number, lng: number): Promise<{
  address: string;
  name: string;
  city?: string;
  state?: string;
}> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=17&addressdetails=1`,
      {
        signal: controller.signal,
        headers: {
          'User-Agent': 'ACCESSVERSE-Accessibility-Platform/1.0',
          'Accept-Language': 'en',
        },
      }
    );
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data && data.display_name) {
        const parts = data.display_name.split(',');
        const name = parts.slice(0, 2).join(',').trim();
        const city = data.address?.city || data.address?.town || data.address?.suburb || data.address?.district || '';
        const state = data.address?.state || '';
        return {
          address: data.display_name,
          name: name || `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
          city,
          state,
        };
      }
    }
  } catch (err) {
    console.warn('[Geocoding] Reverse geocode fallback:', err);
  }

  return {
    address: `Coordinates: ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    name: `Map Point (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
  };
}

/**
 * Resolves any custom user input text to a RoutePoint.
 * First checks coordinates, then local match, then online Nominatim, then fallback with geographic center.
 */
export async function resolveAnyLocation(query: string): Promise<RoutePoint> {
  const trimmed = query.trim();
  if (!trimmed) {
    throw new Error('Please enter a location name or address');
  }

  // 1. Direct coordinates
  const coords = parseCoordinates(trimmed);
  if (coords) {
    return {
      name: `GPS Point (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`,
      address: `Latitude: ${coords.lat.toFixed(5)}, Longitude: ${coords.lng.toFixed(5)}`,
      lat: coords.lat,
      lng: coords.lng,
      isCustom: true,
    };
  }

  // 2. Exact or substring local match
  const local = searchLocalIndianPlaces(trimmed);
  if (local.length > 0) {
    // If exact match on name
    const exact = local.find((l) => l.name.toLowerCase() === trimmed.toLowerCase());
    if (exact) return exact;
    return local[0];
  }

  // 3. Online Nominatim geocoding
  const online = await geocodeNominatim(trimmed);
  if (online.length > 0) {
    return online[0];
  }

  // 4. Fallback search without country restriction
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(trimmed)}&limit=1`,
      {
        headers: { 'User-Agent': 'ACCESSVERSE-Accessibility-Platform/1.0' },
      }
    );
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return {
          name: data[0].display_name.split(',')[0],
          address: data[0].display_name,
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
          isCustom: true,
        };
      }
    }
  } catch (err) {
    // Fallback below
  }

  // 5. Intelligent fallback: Default to center of India with clear marker note
  return {
    name: trimmed,
    address: `${trimmed} (Approximate India Location - Click 'Pick on Map' to fine-tune pin)`,
    lat: 20.5937,
    lng: 78.9629,
    isCustom: true,
  };
}
