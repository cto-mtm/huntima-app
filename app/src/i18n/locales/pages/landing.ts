const en = {
  // The product name is a brand mark, same in every locale.
  title: 'Huntima',
  tagline: 'Verified photo hunts for live events.',
  hint: 'Scan your event’s QR code to start playing.',
  organizerCta: 'Organizer sign in',
}

// Typed against en: a missing or extra key here is a compile error.
const es: typeof en = {
  title: 'Huntima',
  tagline: 'Búsquedas fotográficas verificadas para eventos en vivo.',
  hint: 'Escanea el código QR de tu evento para empezar a jugar.',
  organizerCta: 'Acceso para organizadores',
}

export default { en, es }
