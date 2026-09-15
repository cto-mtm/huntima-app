<script setup lang="ts">
/**
 * The one Leaflet renderer. Every geographic map in the app — the fan's
 * all-missions view, a single mission's location, the admin lat/lng picker —
 * mounts THIS, so tile setup, the marker-icon bundler fix, and the pin-vs-area
 * drawing rules live in exactly one place.
 *
 * ── Leaflet is the library; OpenStreetMap is the imagery ──────
 * Leaflet draws pins, circles, pan and zoom, but ships no map picture. The
 * streets come from a tile provider; we use OpenStreetMap's public tiles,
 * which are free and need no API key or account. That keeps a city-wide hunt
 * zero-cost. (For heavy production traffic OSM's usage policy points you at a
 * dedicated tile host — a config swap here, not a rewrite.)
 *
 * ── The marker-icon fix ───────────────────────────────────────
 * Leaflet's default marker PNGs are resolved by a hardcoded relative path
 * that breaks under a bundler. Rather than fight it, every point we draw is a
 * `divIcon` (an HTML pin we style ourselves), so no image assets are needed
 * and the pin re-skins with the brand `color`.
 *
 * ── Point vs. area ────────────────────────────────────────────
 * `radiusMeters === 0` draws a precise pin. A positive radius draws a
 * translucent circle of that size and NO pin, so a city-wide hunt reads as
 * "somewhere in here" instead of a false exact doorstep. Either is clickable
 * when the point carries an `id`, emitting `select` so a caller can route to
 * the mission.
 */
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export interface MapPoint {
  /** Present when the point should be clickable (routes to this mission). */
  id?: string
  lat: number
  lng: number
  /** 0 = precise pin; > 0 = a translucent hint circle of about this size. */
  radiusMeters: number
  /** Brand/mission color for the pin and circle. */
  color: string
  /** Dimmed styling for an already-earned mission. */
  muted?: boolean
}

const props = withDefaults(
  defineProps<{
    points: MapPoint[]
    /** Fallback centre when there are no points (e.g. an empty picker). */
    center?: [number, number]
    zoom?: number
    /** Picker mode: clicking the map emits `pick` with the coordinates. */
    pickable?: boolean
  }>(),
  { center: () => [39.8283, -98.5795], zoom: 4, pickable: false },
)

const emit = defineEmits<{ select: [id: string]; pick: [lat: number, lng: number] }>()

const el = ref<HTMLDivElement | null>(null)
let map: L.Map | null = null
// Everything we draw lives in one layer group so a data change is a single
// clear-and-redraw rather than hand-tracking individual layers.
let layer: L.LayerGroup | null = null

/** An HTML pin styled by us — sidesteps Leaflet's broken default-icon path. */
function pinIcon(color: string, muted: boolean): L.DivIcon {
  return L.divIcon({
    className: 'leaflet-brand-pin',
    html: `<span class="leaflet-brand-pin__drop" style="--pin:${color};opacity:${muted ? 0.55 : 1}"></span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 26],
  })
}

function draw(): void {
  if (!map || !layer) return
  layer.clearLayers()

  const bounds = L.latLngBounds([])
  for (const p of props.points) {
    const latlng: L.LatLngExpression = [p.lat, p.lng]
    if (p.radiusMeters > 0) {
      const circle = L.circle(latlng, {
        radius: p.radiusMeters,
        color: p.color,
        weight: 2,
        opacity: p.muted ? 0.4 : 0.8,
        fillColor: p.color,
        fillOpacity: p.muted ? 0.08 : 0.15,
      }).addTo(layer)
      if (p.id) {
        const id = p.id
        circle.on('click', () => emit('select', id))
        circle.getElement()?.setAttribute('role', 'button')
      }
      bounds.extend(circle.getBounds())
    } else {
      const marker = L.marker(latlng, {
        icon: pinIcon(p.color, p.muted ?? false),
        keyboard: false,
      }).addTo(layer)
      if (p.id) {
        const id = p.id
        marker.on('click', () => emit('select', id))
      }
      bounds.extend(latlng)
    }
  }

  // Frame everything the map holds. One point → a sensible street-level zoom;
  // several → fit them all with a little breathing room.
  if (props.points.length === 1) {
    map.setView([props.points[0].lat, props.points[0].lng], 15)
  } else if (bounds.isValid()) {
    map.fitBounds(bounds, { padding: [32, 32], maxZoom: 16 })
  }
}

onMounted(() => {
  if (!el.value) return
  map = L.map(el.value, { attributionControl: true }).setView(props.center, props.zoom)
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map)
  layer = L.layerGroup().addTo(map)

  if (props.pickable) {
    map.on('click', (e: L.LeafletMouseEvent) => emit('pick', e.latlng.lat, e.latlng.lng))
  }

  draw()
  // A map created inside a modal/flex parent often measures 0px until the
  // next frame; nudge Leaflet to re-read its size once laid out.
  requestAnimationFrame(() => map?.invalidateSize())
})

watch(() => props.points, draw, { deep: true })

onBeforeUnmount(() => {
  map?.remove()
  map = null
  layer = null
})
</script>

<template>
  <div ref="el" class="leaflet-host" />
</template>

<style>
/* Global (un-scoped) because Leaflet injects the pin markup itself, so a
   scoped selector would never match it. Namespaced under our own class. */
.leaflet-brand-pin__drop {
  display: block;
  width: 26px;
  height: 26px;
  border-radius: 50% 50% 50% 0;
  transform: rotate(-45deg);
  background: var(--pin, #6d28d9);
  border: 2px solid #fff;
  box-shadow: 0 2px 6px rgb(0 0 0 / 0.35);
}
</style>

<style scoped>
.leaflet-host {
  width: 100%;
  height: 100%;
  min-height: 12rem;
  background: var(--color-brand-50);
}
</style>
