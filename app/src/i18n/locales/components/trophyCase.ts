const en = {
  title: 'Trophy case',
  progress: '{earned} of {target} badges',
  emptySlot: 'Empty slot',
  complete: 'Complete! Go claim your prize.',
}

// Typed against en: a missing or extra key here is a compile error.
const es: typeof en = {
  title: 'Vitrina de trofeos',
  progress: '{earned} de {target} insignias',
  emptySlot: 'Espacio vacío',
  complete: '¡Completo! Ve a reclamar tu premio.',
}

export default { en, es }
