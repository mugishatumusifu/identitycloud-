import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './assets/global.css'
import axios from 'axios'

// When deployed on Vercel (frontend) + Render (backend), set VITE_API_URL to
// your Render backend URL so API calls go directly to the backend.
// Leave it empty for local dev — the Vite proxy handles /api requests.
if (import.meta.env.VITE_API_URL) {
  axios.defaults.baseURL = import.meta.env.VITE_API_URL.replace(/\/$/, '')
}

createApp(App).use(router).mount('#app')
