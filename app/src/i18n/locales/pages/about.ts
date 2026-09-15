const en = {
  title: 'How it works',
  // Only About links back to the entry screen, so the key lives here rather
  // than in the entry namespace it used to be borrowed from.
  switchUser: 'Switch user',
  // Points at the platform copy rather than repeating it: legal text kept in
  // two places drifts.
  privacyLinkTitle: 'Your photos and your progress',
  privacyLinkBody: 'How Huntima handles what you snap and what you collect.',
  intro: 'A digital passport for the event — the whole thing in a few steps.',
  step1Title: 'Scan to start',
  step1Body: "Scan the QR code at the event to open today's hunt on your phone.",
  step2Title: 'Find the missions',
  step2Body: 'Each mission is a photo to recreate somewhere around the venue.',
  step3Title: 'Snap the photo',
  step3Body: 'Take the picture and we check it on the spot — a match earns you a badge.',
  step4Title: 'Fill your badge case',
  step4Body: 'Collect enough badges to win the hunt and unlock your prize.',
  step5Title: 'Claim your prize',
  step5Body: 'Show your claim code at {location} to pick it up.',
  finePrintTitle: 'The fine print',
  finePrintBody:
    '{team} runs this hunt for fun during the event. Prizes are limited and available while supplies last. Please stay aware of your surroundings and follow all venue rules and staff instructions while you play.',
}

// Typed against en: a missing or extra key here is a compile error.
const es: typeof en = {
  title: 'Cómo funciona',
  switchUser: 'Cambiar de usuario',
  privacyLinkTitle: 'Tus fotos y tu progreso',
  privacyLinkBody: 'Cómo gestiona Huntima lo que capturas y lo que coleccionas.',
  intro: 'Un pasaporte digital para el evento: todo en unos pasos.',
  step1Title: 'Escanea para empezar',
  step1Body: 'Escanea el código QR en el evento para abrir la búsqueda de hoy en tu teléfono.',
  step2Title: 'Encuentra las misiones',
  step2Body: 'Cada misión es una foto que debes recrear en algún punto del lugar.',
  step3Title: 'Haz la foto',
  step3Body: 'Toma la foto y la comprobamos al momento: si coincide, ganas una insignia.',
  step4Title: 'Llena tu vitrina de insignias',
  step4Body: 'Consigue suficientes insignias para ganar la búsqueda y desbloquear tu premio.',
  step5Title: 'Reclama tu premio',
  step5Body: 'Muestra tu código de canje en {location} para recogerlo.',
  finePrintTitle: 'La letra pequeña',
  finePrintBody:
    '{team} organiza esta búsqueda para divertirse durante el evento. Los premios son limitados y están disponibles hasta agotar existencias. Mantente atento a tu entorno y sigue todas las normas del recinto y las indicaciones del personal mientras juegas.',
}

export default { en, es }
