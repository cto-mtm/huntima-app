const en = {
  // Enum-style: resolved as t('missionCard.kind.' + mission.kind).
  // Adding a mission kind means adding a key here in the same change.
  kind: {
    photo: 'Concourse',
    spyglass: 'On the field',
  },
  statusLocked: 'Not collected',
  statusEarned: 'Collected',
  open: 'Open mission',
}

// Typed against en: a missing or extra key here is a compile error.
const es: typeof en = {
  kind: {
    photo: 'Pasillo',
    spyglass: 'En el campo',
  },
  statusLocked: 'Sin conseguir',
  statusEarned: 'Conseguida',
  open: 'Abrir misión',
}

export default { en, es }
