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
  photosTitle: 'What happens to your photos',
  photosBody:
    'When you snap a mission photo, your phone shrinks it and removes its location data before anything leaves your device. It is sent to be checked against the mission, then discarded right away — we never save your photos or store them anywhere.',
  progressTitle: 'Your progress',
  progressBody:
    'Play as a guest and your badges stay on this phone — clearing your browser data or switching phones starts you over. Sign in and your progress is saved to your account, so your trophies follow you to any device.',
  finePrintTitle: 'The fine print',
  finePrintBody:
    '{team} runs this hunt for fun during the event. Prizes are limited and available while supplies last. Please stay aware of your surroundings and follow all venue rules and staff instructions while you play.',
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
  photosTitle: 'Qué pasa con tus fotos',
  photosBody:
    'Cuando haces una foto de una misión, tu teléfono la reduce y elimina sus datos de ubicación antes de que nada salga del dispositivo. Se envía para comprobarla con la misión y luego se descarta al instante: nunca guardamos tus fotos ni las almacenamos en ningún sitio.',
  progressTitle: 'Tu progreso',
  progressBody:
    'Si juegas como invitado, tus insignias se quedan en este teléfono: si borras los datos del navegador o cambias de teléfono, empezarás de nuevo. Si inicias sesión, tu progreso se guarda en tu cuenta y tus trofeos te acompañan en cualquier dispositivo.',
  finePrintTitle: 'La letra pequeña',
  finePrintBody:
    '{team} organiza esta búsqueda para divertirse durante el evento. Los premios son limitados y están disponibles hasta agotar existencias. Mantente atento a tu entorno y sigue todas las normas del recinto y las indicaciones del personal mientras juegas.',
}

export default { en, es }
