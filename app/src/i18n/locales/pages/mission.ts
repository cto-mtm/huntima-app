const en = {
  hintLabel: 'Hint',
  notFoundTitle: 'Mission not found',
  notFound: 'That mission is not part of the current campaign.',
  backToMissions: 'Back to missions',
  startCapture: 'Open camera',
  alreadyEarned: 'You already collected this badge.',
  targetPhotoMissing: 'Clue photo coming soon — use the hint.',
}

// Typed against en: a missing or extra key here is a compile error.
const es: typeof en = {
  hintLabel: 'Pista',
  notFoundTitle: 'Misión no encontrada',
  notFound: 'Esa misión no forma parte de la campaña actual.',
  backToMissions: 'Volver a las misiones',
  startCapture: 'Abrir cámara',
  alreadyEarned: 'Ya conseguiste esta insignia.',
  targetPhotoMissing: 'Foto de la pista próximamente. Usa la pista escrita.',
}

export default { en, es }
