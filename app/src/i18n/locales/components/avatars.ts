const en = {
  // Accessible names for the bundled platform avatar set (lib/avatars.ts).
  // They are alt text on an <img>, so they are user-facing copy and belong
  // here — the seed data stores these KEYS, never the words themselves.
  star: 'Star',
  bolt: 'Bolt',
  heart: 'Heart',
  sun: 'Sun',
  gem: 'Gem',
  rocket: 'Rocket',
}

// Typed against en: a missing or extra key here is a compile error.
const es: typeof en = {
  star: 'Estrella',
  bolt: 'Rayo',
  heart: 'Corazón',
  sun: 'Sol',
  gem: 'Gema',
  rocket: 'Cohete',
}

export default { en, es }
