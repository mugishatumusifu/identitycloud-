<template>
  <div class="home-wrap">
    <!-- ── HERO ───────────────────────────────────────────────────────────── -->
    <section class="hero glass-card fade-up">
      <div class="hero-badge">
        <Icon name="shield-check" :size="14" />
        <span>Live identity verification</span>
      </div>

      <h1 class="hero-title">Identity Cloud</h1>
      <p class="hero-sub">
        Scan a student's QR code or enter a verification path to view their live identity card —
        instantly, securely, and from any device.
      </p>

      <div class="verify-box">
        <div class="verify-label">
          <Icon name="qr-code" :size="12" />
          Enter verification URL path
        </div>
        <div class="verify-input-row">
          <span class="verify-prefix">/</span>
          <input
            v-model="path"
            class="verify-input"
            placeholder="school-name/STU-00001"
            @keyup.enter="goVerify"
          />
          <button class="verify-btn" @click="goVerify" :disabled="!path.trim()">
            <Icon name="arrow-right" :size="16" />
            <span>Verify</span>
          </button>
        </div>
        <p v-if="error" class="verify-error">
          <Icon name="alert-triangle" :size="13" />
          {{ error }}
        </p>
      </div>
    </section>

    <!-- ── FEATURES ───────────────────────────────────────────────────────── -->
    <section class="features-grid fade-up fade-up-2">
      <div class="feature-card glass-card" v-for="f in features" :key="f.title" :style="{ '--fc': f.color }">
        <div class="feature-icon"><Icon :name="f.icon" :size="22" /></div>
        <h3 class="feature-title">{{ f.title }}</h3>
        <p class="feature-desc">{{ f.desc }}</p>
      </div>
    </section>

    <!-- ── STATS ──────────────────────────────────────────────────────────── -->
    <section class="stats-row fade-up fade-up-3" v-if="stats">
      <div class="stat-item glass-card">
        <div class="stat-icon"><Icon name="building" :size="18" /></div>
        <div>
          <div class="stat-num">{{ stats.totalSchools }}</div>
          <div class="stat-label">Schools</div>
        </div>
      </div>
      <div class="stat-item glass-card">
        <div class="stat-icon"><Icon name="users" :size="18" /></div>
        <div>
          <div class="stat-num">{{ stats.totalStudents }}</div>
          <div class="stat-label">Students</div>
        </div>
      </div>
      <div class="stat-item glass-card">
        <div class="stat-icon active"><Icon name="check-circle" :size="18" /></div>
        <div>
          <div class="stat-num">{{ stats.activeStudents }}</div>
          <div class="stat-label">Active IDs</div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import Icon from '@/components/Icon.vue'

const router = useRouter()
const path   = ref('')
const error  = ref('')
const stats  = ref(null)

const features = [
  { icon: 'qr-code',      color: '#00b4d8', title: 'QR Scan Verification', desc: 'Scan any student QR code to instantly verify their identity in real-time.' },
  { icon: 'shield-check', color: '#06d6a0', title: 'Live Status',          desc: 'Active, expired, or revoked status updated automatically based on expiry date.' },
  { icon: 'activity',     color: '#7b61ff', title: 'Scan Tracking',        desc: 'Every verification is logged with scan count and last scanned timestamp.' },
  { icon: 'school',       color: '#0077b6', title: 'Multi-School',         desc: 'Each school has its own namespace. Students are isolated per school slug.' },
]

function goVerify() {
  const trimmed = path.value.trim()
  if (!trimmed) return
  const parts = trimmed.replace(/^\//, '').split('/')
  if (parts.length < 2) {
    error.value = 'Please enter a path like: school-name/STU-00001'
    return
  }
  error.value = ''
  router.push(`/${parts[0]}/${parts.slice(1).join('/')}`)
}

onMounted(async () => {
  try {
    const { data } = await axios.get('/api/stats')
    stats.value = data
  } catch (_) {}
})
</script>

<style scoped>
.home-wrap { display: flex; flex-direction: column; gap: 22px; }

/* ── Hero ─────────────────────────────────────────────────────────────────── */
.hero {
  padding: 56px 40px 44px;
  text-align: center;
  display: flex; flex-direction: column; align-items: center; gap: 14px;
  position: relative;
  overflow: hidden;
}
.hero::before {
  content: '';
  position: absolute; inset: 0;
  background:
    radial-gradient(circle at 20% 0%, rgba(0,180,216,0.18), transparent 50%),
    radial-gradient(circle at 80% 100%, rgba(6,214,160,0.15), transparent 50%);
  pointer-events: none;
  z-index: 0;
}
.hero > * { position: relative; z-index: 1; }

.hero-badge {
  display: inline-flex; align-items: center; gap: 6px;
  background: rgba(0,180,216,0.1);
  border: 1px solid rgba(0,180,216,0.22);
  color: var(--accent-2);
  padding: 5px 12px;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.hero-title {
  font-size: clamp(2rem, 6vw, 2.8rem);
  font-weight: 800;
  letter-spacing: -0.03em;
  background: linear-gradient(135deg, var(--accent-2), var(--accent), var(--accent-green));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.hero-sub {
  font-size: clamp(0.95rem, 2.2vw, 1.05rem);
  color: var(--text-secondary);
  max-width: 480px;
  line-height: 1.6;
}

/* ── Verify box ───────────────────────────────────────────────────────────── */
.verify-box {
  margin-top: 12px;
  width: 100%;
  max-width: 540px;
}
.verify-label {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: var(--text-muted);
  margin-bottom: 8px;
}
.verify-input-row {
  display: flex;
  align-items: center;
  background: rgba(255,255,255,0.85);
  border: 1.5px solid rgba(0,180,216,0.22);
  border-radius: 14px;
  overflow: hidden;
  transition: border-color var(--ease), box-shadow var(--ease);
}
.verify-input-row:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 4px var(--accent-glow);
}
.verify-prefix {
  padding: 14px 6px 14px 16px;
  font-family: var(--font-mono);
  font-size: 0.95rem;
  color: var(--text-muted);
}
.verify-input {
  flex: 1;
  padding: 14px 8px;
  font-family: var(--font-mono);
  font-size: 0.9rem;
  border: none; outline: none; background: transparent;
  color: var(--text-primary);
  min-width: 0;
}
.verify-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 11px 18px;
  margin: 5px;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  color: #fff;
  border: none;
  border-radius: 10px;
  font-weight: 700;
  font-size: 0.88rem;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.2s;
  white-space: nowrap;
  box-shadow: 0 6px 16px -6px rgba(0,180,216,0.5);
}
.verify-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 10px 22px -6px rgba(0,180,216,0.6); }
.verify-btn:disabled { opacity: 0.5; cursor: default; box-shadow: none; }

.verify-error {
  margin-top: 10px;
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 0.82rem;
  color: var(--status-expired);
}

/* ── Features ─────────────────────────────────────────────────────────────── */
.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 14px;
}
.feature-card {
  padding: 22px 20px;
  display: flex; flex-direction: column; gap: 10px;
  border-top: 3px solid var(--fc, var(--accent));
  transition: transform var(--transition), box-shadow var(--ease);
  border-radius: 18px;
}
.feature-card:hover { transform: translateY(-4px); box-shadow: 0 16px 48px rgba(0,60,100,0.14); }
.feature-icon {
  width: 42px; height: 42px;
  border-radius: 12px;
  background: color-mix(in oklab, var(--fc, var(--accent)) 18%, transparent);
  color: var(--fc, var(--accent));
  display: flex; align-items: center; justify-content: center;
}
.feature-title { font-size: 0.98rem; font-weight: 700; color: var(--text-primary); }
.feature-desc  { font-size: 0.84rem; color: var(--text-secondary); line-height: 1.55; }

/* ── Stats ────────────────────────────────────────────────────────────────── */
.stats-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}
.stat-item {
  display: flex; align-items: center; gap: 14px;
  padding: 18px;
  border-radius: 18px;
}
.stat-icon {
  width: 40px; height: 40px;
  border-radius: 12px;
  background: rgba(0,180,216,0.12);
  color: var(--accent-2);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.stat-icon.active { background: rgba(6,214,160,0.15); color: #028a65; }
.stat-num {
  font-size: 1.7rem; font-weight: 700;
  font-family: var(--font-mono);
  color: var(--text-primary);
  line-height: 1;
}
.stat-label {
  font-size: 0.72rem; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.06em;
  color: var(--text-muted);
  margin-top: 4px;
}

@media (max-width: 640px) {
  .hero { padding: 40px 22px 36px; }
  .stats-row { grid-template-columns: 1fr; }
  .stat-item { padding: 14px 18px; }
}
@media (max-width: 420px) {
  .verify-prefix { font-size: 0.85rem; padding-left: 12px; padding-right: 4px; }
  .verify-btn span { display: none; }
  .verify-btn { padding: 11px 12px; }
}
</style>
