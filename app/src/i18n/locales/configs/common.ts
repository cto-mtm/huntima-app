// Cross-cutting vocabulary used by more than one feature.
// If a string is only used in one place, it belongs in that feature's module.

const en = {
  back: 'Back',
  next: 'Next',
  cancel: 'Cancel',
  close: 'Close',
  done: 'Done',
  loading: 'Loading…',
  retry: 'Try again',
  error: 'Something went wrong.',
  offline: 'Offline — showing saved missions.',
}

// Typed against en: a missing or extra key here is a compile error.
const es: typeof en = {
  back: 'Atrás',
  next: 'Siguiente',
  cancel: 'Cancelar',
  close: 'Cerrar',
  done: 'Listo',
  loading: 'Cargando…',
  retry: 'Reintentar',
  error: 'Algo salió mal.',
  offline: 'Sin conexión: mostrando misiones guardadas.',
}

export default { en, es }
