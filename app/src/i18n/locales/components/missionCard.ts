const en = {
  // Enum-style: resolved as t('missionCard.kind.' + mission.kind).
  // Adding a mission kind means adding a key here in the same change.
  kind: {
    photo: 'Concourse',
    spyglass: 'On the field',
  },
  // A pending mission is an invitation, not a deficit: "Snap it!" beats a
  // red "Not collected" for a twelve-year-old with a phone.
  statusLocked: 'Snap it!',
  statusEarned: 'Got it!',
  open: 'Open mission',
}

// Typed against en: a missing or extra key here is a compile error.
const es: typeof en = {
  kind: {
    photo: 'Pasillo',
    spyglass: 'En el campo',
  },
  statusLocked: '¡Captúralo!',
  statusEarned: '¡Conseguida!',
  open: 'Abrir misión',
}

export default { en, es }
