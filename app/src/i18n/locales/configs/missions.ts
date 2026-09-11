// Mission content for the seeded demo campaign.
//
// The API returns i18n KEYS (`titleKey`, `hintKey`), not display strings —
// see docs/i18n.md § "Translate data, not just UI chrome". These are the
// keys it returns.
//
// Once the admin campaign builder ships, staff-authored missions will carry
// per-locale text written by the team instead. This module stays as the
// demo/fallback campaign.

const en = {
  gateStatue: {
    title: 'The Legend at the Gate',
    hint: 'Find the bronze statue near the main gate and frame the face.',
  },
  westConcourse: {
    title: 'Big Cup Energy',
    hint: 'The giant soda cup at the West Concourse stand. You cannot miss it.',
  },
  teamStore: {
    title: 'Jersey Wall',
    hint: 'Inside the team store, find the wall of hanging jerseys.',
  },
  foulPole: {
    title: 'Down the Line',
    hint: 'Stand where you can see the whole foul pole, top to bottom.',
  },
  player22: {
    title: 'Spot Number 22',
    hint: 'Zoom in on the field and frame the number 22 on a jersey.',
  },
  mascot: {
    title: 'Mascot Hunt',
    hint: 'The mascot is working the crowd. Catch it in the box.',
  },
}

// Typed against en: a missing or extra key here is a compile error.
const es: typeof en = {
  gateStatue: {
    title: 'La leyenda de la entrada',
    hint: 'Busca la estatua de bronce junto a la entrada principal y encuadra el rostro.',
  },
  westConcourse: {
    title: 'El vaso gigante',
    hint: 'El vaso de refresco gigante del puesto del pasillo oeste. Imposible no verlo.',
  },
  teamStore: {
    title: 'Muro de camisetas',
    hint: 'Dentro de la tienda del equipo, busca el muro de camisetas colgadas.',
  },
  foulPole: {
    title: 'Por la línea',
    hint: 'Colócate donde puedas ver el poste de foul completo, de arriba a abajo.',
  },
  player22: {
    title: 'Encuentra el número 22',
    hint: 'Haz zoom en el campo y encuadra el número 22 de una camiseta.',
  },
  mascot: {
    title: 'Caza la mascota',
    hint: 'La mascota anda entre el público. Atrápala en el recuadro.',
  },
}

export default { en, es }
