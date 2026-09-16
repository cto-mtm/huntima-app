const en = {
  // A pending mission is an invitation, not a deficit: "Snap it!" beats a
  // red "Not collected" for a twelve-year-old with a phone.
  statusLocked: 'Snap it!',
  statusEarned: 'Got it!',
  open: 'Open mission',
}

// Typed against en: a missing or extra key here is a compile error.
const es: typeof en = {
  statusLocked: '¡Captúralo!',
  statusEarned: '¡Conseguida!',
  open: 'Abrir misión',
}

export default { en, es }
