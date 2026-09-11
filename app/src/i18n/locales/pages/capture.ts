const en = {
  stubNotice: 'Camera not wired up yet — this button simulates a capture.',
  framePhoto: 'Frame the object and capture.',
  frameSpyglass: 'Zoom in until the target fills the box, then capture.',
  zoomLabel: 'Zoom',
  capture: 'Capture',
  scanning: 'Scanning…',
  successTitle: 'Badge unlocked!',
  successBody: 'Added to your trophy case.',
  keepGoing: 'Keep hunting',
  viewTrophies: 'View trophy case',
}

// Typed against en: a missing or extra key here is a compile error.
const es: typeof en = {
  stubNotice: 'La cámara aún no está conectada: este botón simula una captura.',
  framePhoto: 'Encuadra el objeto y captura.',
  frameSpyglass: 'Haz zoom hasta llenar el recuadro y captura.',
  zoomLabel: 'Zoom',
  capture: 'Capturar',
  scanning: 'Escaneando…',
  successTitle: '¡Insignia desbloqueada!',
  successBody: 'Añadida a tu vitrina de trofeos.',
  keepGoing: 'Seguir buscando',
  viewTrophies: 'Ver la vitrina',
}

export default { en, es }
