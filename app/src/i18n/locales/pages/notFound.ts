const en = {
  title: 'Foul ball',
  body: 'That page is out of play.',
  home: 'Back to the start',
  // Shown when a URL names an organization that does not exist — a mistyped
  // slug must read as "no team here", never render a phantom default club.
  tenantTitle: 'No team here',
  tenantBody: 'There’s no event page at this address. Check the link or QR code you followed.',
}

// Typed against en: a missing or extra key here is a compile error.
const es: typeof en = {
  title: 'Bola de foul',
  body: 'Esa página está fuera de juego.',
  home: 'Volver al inicio',
  tenantTitle: 'Aquí no hay equipo',
  tenantBody: 'No hay ninguna página de evento en esta dirección. Revisa el enlace o el código QR.',
}

export default { en, es }
