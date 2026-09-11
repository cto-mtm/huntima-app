const en = {
  title: 'Foul ball',
  body: 'That page is out of play.',
  home: 'Back to missions',
}

// Typed against en: a missing or extra key here is a compile error.
const es: typeof en = {
  title: 'Bola de foul',
  body: 'Esa página está fuera de juego.',
  home: 'Volver a las misiones',
}

export default { en, es }
