<template>
  <div class="login-page">
    <div class="bg-orbs"></div>

    <div class="login-card glass-card fade-up">
      <div class="brand-mark">
        <Icon name="shield-check" :size="32" />
      </div>
      <h1 class="login-title">Admin Console</h1>
      <p class="login-sub">Sign in to manage Identity Cloud</p>

      <form class="login-form" @submit.prevent="handleSubmit">
        <label class="field">
          <span class="field-label">
            <Icon name="user" :size="14" /> Username
          </span>
          <input
            v-model="username"
            type="text"
            autocomplete="username"
            placeholder="admin"
            required
            :disabled="loading"
          />
        </label>

        <label class="field">
          <span class="field-label">
            <Icon name="lock" :size="14" /> Password
          </span>
          <div class="password-wrap">
            <input
              v-model="password"
              :type="showPwd ? 'text' : 'password'"
              autocomplete="current-password"
              placeholder="••••••••"
              required
              :disabled="loading"
            />
            <button
              type="button"
              class="eye-btn"
              @click="showPwd = !showPwd"
              :aria-label="showPwd ? 'Hide password' : 'Show password'"
            >
              <Icon :name="showPwd ? 'eye-off' : 'eye'" :size="16" />
            </button>
          </div>
        </label>

        <Transition name="slide">
          <div v-if="error" class="error-banner">
            <Icon name="alert-triangle" :size="16" />
            <span>{{ error }}</span>
          </div>
        </Transition>

        <button class="submit-btn" type="submit" :disabled="loading || !username || !password">
          <span v-if="loading" class="spinner-sm"></span>
          <Icon v-else name="unlock" :size="16" />
          <span>{{ loading ? 'Signing in…' : 'Sign in' }}</span>
        </button>
      </form>

      <a href="/" class="back-home">
        <Icon name="arrow-left" :size="14" />
        Back to Identity Cloud
      </a>
    </div>

    <p class="hint">
      <Icon name="info" :size="12" />
      First time? Run
      <code>node create-admin.js</code> in the backend folder.
    </p>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import Icon from '@/components/Icon.vue'

const router   = useRouter()
const username = ref('')
const password = ref('')
const showPwd  = ref(false)
const loading  = ref(false)
const error    = ref('')

onMounted(() => {
  if (localStorage.getItem('ic_admin_token')) {
    router.replace({ name: 'admin-dashboard' })
  }
})

async function handleSubmit() {
  error.value = ''
  loading.value = true
  try {
    const { data } = await axios.post('/api/admin/login', {
      username: username.value.trim(),
      password: password.value,
    })
    localStorage.setItem('ic_admin_token', data.token)
    localStorage.setItem('ic_admin_user',  data.username)
    router.push({ name: 'admin-dashboard' })
  } catch (e) {
    error.value = e?.response?.data?.error || 'Login failed. Check your credentials.'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  min-height: 80vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
  position: relative;
}
.bg-orbs {
  position: absolute; inset: 0; pointer-events: none; z-index: -1;
}
.login-card {
  width: 100%;
  max-width: 420px;
  padding: 40px 32px 32px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}
.brand-mark {
  width: 64px; height: 64px;
  border-radius: 20px;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  color: #fff;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 12px 32px -8px rgba(0,180,216,0.45);
  margin-bottom: 12px;
}
.login-title {
  font-size: 1.6rem;
  font-weight: 700;
  background: linear-gradient(135deg, var(--accent-2), var(--accent));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.login-sub {
  color: var(--text-muted);
  font-size: 0.9rem;
  margin-bottom: 18px;
}

.login-form {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.field {
  display: flex; flex-direction: column; gap: 6px;
}
.field-label {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: var(--text-muted);
}
.field input {
  padding: 12px 14px;
  border-radius: 12px;
  border: 1.5px solid rgba(0,180,216,0.18);
  background: rgba(255,255,255,0.85);
  font-family: var(--font-body);
  font-size: 0.95rem;
  color: var(--text-primary);
  transition: border-color var(--ease), box-shadow var(--ease);
  width: 100%;
}
.field input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 4px var(--accent-glow);
}
.password-wrap { position: relative; }
.eye-btn {
  position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
  border: none; background: transparent; cursor: pointer;
  color: var(--text-muted); padding: 8px; border-radius: 8px;
}
.eye-btn:hover { color: var(--accent); background: rgba(0,180,216,0.08); }

.error-banner {
  display: inline-flex; align-items: center; gap: 8px;
  background: rgba(239,71,111,0.1);
  color: #c0264b;
  border: 1px solid rgba(239,71,111,0.25);
  padding: 9px 12px; border-radius: 10px;
  font-size: 0.85rem;
}

.submit-btn {
  margin-top: 4px;
  padding: 12px 18px;
  border-radius: 12px;
  border: none;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  color: #fff;
  font-weight: 700;
  font-size: 0.95rem;
  cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  box-shadow: 0 8px 20px -8px rgba(0,180,216,0.5);
  transition: transform 0.15s, box-shadow 0.2s, opacity 0.2s;
}
.submit-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 12px 28px -8px rgba(0,180,216,0.6); }
.submit-btn:disabled { opacity: 0.55; cursor: default; }

.spinner-sm {
  width: 14px; height: 14px;
  border: 2px solid rgba(255,255,255,0.4);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.back-home {
  margin-top: 18px;
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 0.8rem;
  color: var(--text-muted);
  text-decoration: none;
}
.back-home:hover { color: var(--accent); text-decoration: none; }

.hint {
  margin-top: 18px;
  font-size: 0.78rem;
  color: var(--text-muted);
  display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap;
  justify-content: center;
  text-align: center;
  max-width: 420px;
}
.hint code {
  background: rgba(0,0,0,0.06);
  padding: 2px 6px; border-radius: 6px;
  font-family: var(--font-mono); font-size: 0.78rem;
  color: var(--accent-2);
}

.slide-enter-active, .slide-leave-active { transition: all 0.2s ease; }
.slide-enter-from, .slide-leave-to { opacity: 0; transform: translateY(-4px); }

@media (max-width: 480px) {
  .login-card { padding: 32px 22px 26px; border-radius: 22px; }
  .login-title { font-size: 1.4rem; }
}
</style>
