import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { i18n } from './i18n'
import { registerNative } from './lib/native'
import './assets/css/main.css'

const app = createApp(App)

// Pinia must be installed before the router: the onboarding guard in
// router/index.ts calls useProgressStore() on the very first navigation.
app.use(createPinia())
app.use(i18n)
app.use(router)

// No-op in the browser; wires the Android back button in native shells.
registerNative(router)

app.mount('#app')
