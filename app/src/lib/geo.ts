interface Point {
  lat: number
  lng: number
}

/**
 * Great-circle (haversine) distance in metres between two lat/lng points.
 *
 * Good to a few metres at stadium scale, which is far tighter than the GPS fix
 * a phone gets in a concrete bowl — so the fuzziness is the device's, not this.
 */
export function distanceMeters(a: Point, b: Point): number {
  const R = 6_371_000 // Earth's mean radius, metres
  const toRad = (deg: number): number => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}
