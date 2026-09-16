const en = {
  // The product name is a brand mark, same in every locale.
  title: 'Huntima',
  tagline: 'Verified photo hunts for live events.',
  signInCta: 'Sign in or create an account',
  hint: 'At an event? Scan its QR code to start playing.',
}

// Typed against en: a missing or extra key here is a compile error.
const es: typeof en = {
  title: 'Huntima',
  tagline: 'Búsquedas fotográficas verificadas para eventos en vivo.',
  signInCta: 'Inicia sesión o crea una cuenta',
  hint: '¿Estás en un evento? Escanea su código QR para empezar a jugar.',
}

export default { en, es }
