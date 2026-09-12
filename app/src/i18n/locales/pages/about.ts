const en = {
  title: 'How it works',
  intro: 'A digital passport for game day — the whole game in a few steps.',
  step1Title: 'Scan to start',
  step1Body: "Scan the QR code on the jumbotron to open today's hunt on your phone.",
  step2Title: 'Find the missions',
  step2Body: 'Each mission is a photo to recreate somewhere around the concourse.',
  step3Title: 'Snap the photo',
  step3Body: 'Take the picture and we check it on the spot — a match earns you a badge.',
  step4Title: 'Fill your trophy case',
  step4Body: 'Collect enough badges to win the hunt and unlock your prize.',
  step5Title: 'Claim your prize',
  step5Body: 'Show your claim code at {location} to pick it up.',
}

// Typed against en: a missing or extra key here is a compile error.
const es: typeof en = {
  title: 'Cómo funciona',
  intro: 'Un pasaporte digital para el día del partido: todo el juego en unos pasos.',
  step1Title: 'Escanea para empezar',
  step1Body: 'Escanea el código QR de la pantalla gigante para abrir la búsqueda de hoy en tu teléfono.',
  step2Title: 'Encuentra las misiones',
  step2Body: 'Cada misión es una foto que debes recrear en algún punto del estadio.',
  step3Title: 'Haz la foto',
  step3Body: 'Toma la foto y la comprobamos al momento: si coincide, ganas una insignia.',
  step4Title: 'Llena tu vitrina de trofeos',
  step4Body: 'Consigue suficientes insignias para ganar la búsqueda y desbloquear tu premio.',
  step5Title: 'Reclama tu premio',
  step5Body: 'Muestra tu código de canje en {location} para recogerlo.',
}

export default { en, es }
