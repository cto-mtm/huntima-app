const en = {
  title: 'Your organizations',
  empty: 'This account doesn’t belong to any organization yet.',
  loadFailed: 'Could not load your organizations.',
  open: 'Open console',
  view: 'View fan page',
  role: {
    owner: 'Owner',
    editor: 'Editor',
    operator: 'Operator',
  },
}

// Typed against en: a missing or extra key here is a compile error.
const es: typeof en = {
  title: 'Tus organizaciones',
  empty: 'Esta cuenta todavía no pertenece a ninguna organización.',
  loadFailed: 'No se pudieron cargar tus organizaciones.',
  open: 'Abrir consola',
  view: 'Ver página de fans',
  role: {
    owner: 'Propietario',
    editor: 'Editor',
    operator: 'Operador',
  },
}

export default { en, es }
