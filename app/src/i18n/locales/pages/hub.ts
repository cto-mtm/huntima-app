const en = {
  greeting: 'Hey {nickname}!',
  title: 'Your missions',
  empty: 'No missions yet — check back at first pitch.',
  shuffle: 'Shuffle',
  shuffleHint: 'Reorder the list (demo of the list animation recipe)',
}

// Typed against en: a missing or extra key here is a compile error.
const es: typeof en = {
  greeting: '¡Hola {nickname}!',
  title: 'Tus misiones',
  empty: 'Aún no hay misiones. Vuelve en el primer lanzamiento.',
  shuffle: 'Mezclar',
  shuffleHint: 'Reordena la lista (demo de la receta de animación de listas)',
}

export default { en, es }
