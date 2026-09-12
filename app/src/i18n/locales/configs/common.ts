// Cross-cutting vocabulary used by more than one feature.
// If a string is only used in one place, it belongs in that feature's module.

const en = {
  guest: 'Guest',
  back: 'Back',
  next: 'Next',
  cancel: 'Cancel',
  close: 'Close',
  done: 'Done',
  loading: 'Loading…',
  retry: 'Try again',
  error: 'Something went wrong.',
}

// Typed against en: a missing or extra key here is a compile error.
const es: typeof en = {
  guest: 'Invitado',
  back: 'Atrás',
  next: 'Siguiente',
  cancel: 'Cancelar',
  close: 'Cerrar',
  done: 'Listo',
  loading: 'Cargando…',
  retry: 'Reintentar',
  error: 'Algo salió mal.',
}

export default { en, es }
