<template>
  <div class="verify-page">

    <!-- ── Loading State ─────────────────────────────────────────────────── -->
    <div v-if="loading" class="loading-wrap fade-up">
      <div class="loading-card glass-card">
        <div class="loading-anim">
          <div class="loading-ring"></div>
          <div class="loading-icon"><Icon name="shield-check" :size="22" /></div>
        </div>
        <p class="loading-text">Verifying identity…</p>
        <p class="loading-sub">Connecting to Identity Cloud</p>
      </div>
    </div>

    <!-- ── Error State ────────────────────────────────────────────────────── -->
    <div v-else-if="error" class="error-wrap fade-up">
      <div class="error-card glass-card">
        <div class="error-icon"><Icon name="alert-triangle" :size="28" /></div>
        <h2 class="error-title">Identity Not Found</h2>
        <p class="error-msg">This identity is invalid or has not been published to Identity Cloud.</p>
        <div class="error-meta">
          <span class="mono-text">{{ schoolSlug }} / {{ studentId }}</span>
        </div>
        <a href="/" class="back-btn"><Icon name="arrow-left" :size="14" /> Back to Home</a>
      </div>
    </div>

    <!-- ── Identity Card ──────────────────────────────────────────────────── -->
    <div v-else-if="data" class="card-wrap">

      <div class="id-card glass-card fade-up" :style="cardAccentVars">
        <!-- Top accent bar -->
        <div class="card-accent-bar" :style="{ background: themeGradient }"></div>

        <!-- Header section -->
        <div class="card-header">
          <div class="photo-wrap" :class="`status-${data.student.status}`">
            <img
              v-if="data.student.photoUrl && !photoErr"
              :src="data.student.photoUrl"
              :alt="data.student.fullName"
              class="student-photo"
              @error="photoErr = true"
            />
            <div v-else class="photo-placeholder">{{ initials }}</div>
            <div class="status-ring" :class="`ring-${data.student.status}`"></div>
            <div class="status-corner" :class="`corner-${data.student.status}`">
              <Icon :name="statusIcon" :size="14" />
            </div>
          </div>

          <div class="header-info">
            <div class="school-name fade-up fade-up-1">
              <Icon name="school" :size="13" />
              {{ data.school.name }}
            </div>
            <h1 class="student-name fade-up fade-up-2">{{ data.student.fullName }}</h1>
            <div class="status-badge-wrap fade-up fade-up-3">
              <span class="badge" :class="`badge-${data.student.status}`">
                <span class="badge-dot"></span>
                {{ statusLabel }}
              </span>
              <span v-if="statusSubLabel" class="status-sub">{{ statusSubLabel }}</span>
            </div>
          </div>
        </div>

        <!-- Validity progress (if expiry) -->
        <div v-if="validityPercent !== null" class="validity-bar">
          <div class="validity-fill" :style="{ width: validityPercent + '%', background: themeColor }"></div>
        </div>

        <!-- Identity details -->
        <div class="details-section">
          <div class="section-label">
            <Icon name="id-card" :size="12" />
            <span>Identity Details</span>
          </div>
          <div class="details-grid">
            <DetailItem icon="hash"     label="Student ID" :value="data.student.studentId" mono />
            <DetailItem v-if="data.student.class" icon="graduate" label="Class" :value="data.student.class" />
            <DetailItem icon="calendar" label="Issued" :value="formatDate(data.student.issuedAt)" />
            <DetailItem v-if="data.student.expiresAt" icon="hourglass" label="Expires" :value="formatDate(data.student.expiresAt)" />
            <DetailItem
              v-if="data.student.remainingDays !== null"
              icon="clock"
              label="Remaining"
              :value="data.student.remainingDays === 0 ? 'Expires today' : `${data.student.remainingDays} day${data.student.remainingDays === 1 ? '' : 's'}`"
            />
            <DetailItem icon="shield-check" label="Status" :value="statusLabel" />
          </div>
        </div>

        <!-- Verification Record -->
        <div class="verify-section">
          <div class="section-label">
            <Icon name="scan" :size="12" />
            <span>Verification Record</span>
          </div>
          <div class="verify-grid">
            <div class="verify-stat">
              <div class="verify-stat-icon"><Icon name="scan" :size="16" /></div>
              <div>
                <div class="verify-stat-num">{{ data.student.scanCount || 0 }}</div>
                <div class="verify-stat-label">Total Scans</div>
              </div>
            </div>
            <div class="verify-stat">
              <div class="verify-stat-icon"><Icon name="clock" :size="16" /></div>
              <div>
                <div class="verify-stat-num">{{ formatRelative(data.student.lastScannedAt) }}</div>
                <div class="verify-stat-label">Last Verified</div>
              </div>
            </div>
          </div>

          <button class="copy-btn" @click="copyLink">
            <Icon :name="copied ? 'check' : 'copy'" :size="14" />
            <span>{{ copied ? 'Copied!' : 'Copy verification link' }}</span>
          </button>

          <div class="verified-badge">
            <Icon name="shield-check" :size="16" />
            <span>Verified by Identity Cloud</span>
          </div>
        </div>

        <!-- Footer -->
        <div class="card-footer">
          <Icon name="hash" :size="11" />
          <span class="footer-mono">{{ schoolSlug }}</span>
          <span class="footer-sep">·</span>
          <span class="footer-mono">{{ studentId }}</span>
        </div>
      </div>

      <div class="back-link fade-up fade-up-5">
        <a href="/"><Icon name="arrow-left" :size="13" /> Identity Cloud Home</a>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, h } from 'vue'
import axios from 'axios'
import Icon from '@/components/Icon.vue'

// Sub-component: a single detail row (uses Icon)
const DetailItem = {
  props: ['icon', 'label', 'value', 'mono'],
  setup(props) {
    return () => h('div', { class: 'detail-item' }, [
      h('div', { class: 'detail-icon' }, [h(Icon, { name: props.icon, size: 16 })]),
      h('div', { class: 'detail-body' }, [
        h('div', { class: 'detail-label' }, props.label),
        h('div', { class: ['detail-value', { mono: props.mono }] }, props.value),
      ]),
    ])
  },
}

const props = defineProps({
  schoolSlug: { type: String, required: true },
  studentId:  { type: String, required: true },
})

const loading  = ref(true)
const error    = ref(false)
const data     = ref(null)
const photoErr = ref(false)
const copied   = ref(false)

const initials = computed(() => {
  if (!data.value?.student?.fullName) return '?'
  return data.value.student.fullName.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
})

const statusLabel = computed(() => {
  const s = data.value?.student?.status
  if (s === 'active')  return 'Active'
  if (s === 'expired') return 'Expired'
  if (s === 'revoked') return 'Revoked'
  return s || 'Unknown'
})
const statusSubLabel = computed(() => {
  const st = data.value?.student
  if (!st) return ''
  if (st.status === 'active' && st.expiresAt) return `Valid until ${formatDate(st.expiresAt)}`
  if (st.status === 'expired') return 'This identity has expired'
  if (st.status === 'revoked') return 'This identity has been revoked'
  return ''
})
const statusIcon = computed(() => {
  const s = data.value?.student?.status
  if (s === 'active')  return 'check'
  if (s === 'expired') return 'hourglass'
  if (s === 'revoked') return 'x'
  return 'circle'
})

const themeColor = computed(() => data.value?.school?.themeColor || '#00b4d8')
const themeGradient = computed(() => `linear-gradient(90deg, ${themeColor.value}cc, ${themeColor.value}44)`)
const cardAccentVars = computed(() => ({ '--card-accent': themeColor.value }))

const validityPercent = computed(() => {
  const st = data.value?.student
  if (!st?.issuedAt || !st?.expiresAt || st.status !== 'active') return null
  const issued = new Date(st.issuedAt).getTime()
  const expires = new Date(st.expiresAt).getTime()
  const now = Date.now()
  if (expires <= issued) return null
  const elapsed = Math.max(0, Math.min(1, (now - issued) / (expires - issued)))
  return Math.round((1 - elapsed) * 100)
})

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatRelative(iso) {
  if (!iso) return 'Never'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)  return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(window.location.href)
    copied.value = true
    setTimeout(() => { copied.value = false }, 1800)
  } catch (_) {}
}

onMounted(async () => {
  try {
    const { data: result } = await axios.get(
      `/api/verify/${encodeURIComponent(props.schoolSlug)}/${encodeURIComponent(props.studentId)}`
    )
    // Guard against unexpected HTML responses (e.g. misconfigured proxy)
    if (!result || typeof result !== 'object' || !result.student) {
      throw new Error('Invalid response from verification server')
    }
    data.value = result
  } catch (e) {
    error.value = true
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.verify-page { min-height: 60vh; }

/* ── Loading ───────────────────────────────────────────────────────────────── */
.loading-wrap { display: flex; justify-content: center; padding: 60px 0; }
.loading-card {
  padding: 48px 44px;
  text-align: center;
  display: flex; flex-direction: column; align-items: center; gap: 14px;
  min-width: 280px;
  border-radius: 22px;
}
.loading-anim {
  position: relative;
  width: 64px; height: 64px;
  display: flex; align-items: center; justify-content: center;
}
.loading-ring {
  position: absolute; inset: 0;
  border: 2.5px solid rgba(0,180,216,0.15);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.loading-icon { position: relative; z-index: 1; color: var(--accent); }
.loading-text { font-weight: 700; font-size: 1.05rem; color: var(--text-primary); }
.loading-sub  { font-size: 0.82rem; color: var(--text-muted); }

/* ── Error ─────────────────────────────────────────────────────────────────── */
.error-wrap { display: flex; justify-content: center; padding: 60px 0; }
.error-card {
  padding: 44px 32px;
  text-align: center;
  display: flex; flex-direction: column; align-items: center; gap: 12px;
  max-width: 420px;
  border-radius: 22px;
}
.error-icon {
  width: 64px; height: 64px;
  border-radius: 18px;
  background: rgba(239,71,111,0.12);
  color: #ef476f;
  display: flex; align-items: center; justify-content: center;
}
.error-title { font-size: 1.4rem; font-weight: 700; color: var(--text-primary); }
.error-msg { font-size: 0.92rem; color: var(--text-secondary); line-height: 1.6; }
.error-meta {
  background: rgba(0,0,0,0.04);
  border-radius: 8px;
  padding: 8px 16px;
}
.mono-text { font-family: var(--font-mono); font-size: 0.78rem; color: var(--text-muted); }
.back-btn {
  display: inline-flex; align-items: center; gap: 6px;
  margin-top: 8px;
  padding: 10px 22px;
  background: var(--accent); color: #fff;
  border-radius: 10px; font-weight: 600;
  font-size: 0.88rem; text-decoration: none;
}
.back-btn:hover { background: var(--accent-2); text-decoration: none; }

/* ── ID Card ───────────────────────────────────────────────────────────────── */
.card-wrap { display: flex; flex-direction: column; gap: 18px; }
.id-card { overflow: hidden; position: relative; border-radius: 24px; }
.card-accent-bar { height: 5px; width: 100%; }

/* ── Card Header ───────────────────────────────────────────────────────────── */
.card-header {
  display: flex; align-items: flex-start; gap: 22px;
  padding: 26px 28px 22px;
}
.photo-wrap { position: relative; flex-shrink: 0; }
.student-photo, .photo-placeholder {
  width: 100px; height: 100px;
  border-radius: 24px;
  object-fit: cover;
}
.photo-placeholder {
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, var(--accent), var(--accent-green));
  color: #fff;
  font-size: 1.9rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}
.status-ring {
  position: absolute; inset: -4px;
  border-radius: 28px;
  border: 2.5px solid transparent;
  pointer-events: none;
}
.ring-active  { border-color: var(--status-active);  box-shadow: 0 0 0 2px rgba(6,214,160,0.15); }
.ring-expired { border-color: var(--status-expired); box-shadow: 0 0 0 2px rgba(239,71,111,0.12); }
.ring-revoked { border-color: var(--status-revoked); box-shadow: 0 0 0 2px rgba(255,149,0,0.12); }
.status-active { animation: pulseRing 2.4s ease-in-out infinite; }
@keyframes pulseRing {
  0%, 100% { box-shadow: 0 0 0 2px rgba(6,214,160,0.15); }
  50%      { box-shadow: 0 0 0 6px rgba(6,214,160,0.05); }
}
.status-corner {
  position: absolute;
  bottom: -4px; right: -4px;
  width: 28px; height: 28px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  color: #fff;
  border: 3px solid #fff;
}
.corner-active  { background: var(--status-active); }
.corner-expired { background: var(--status-expired); }
.corner-revoked { background: var(--status-revoked); }

.header-info {
  flex: 1;
  display: flex; flex-direction: column; gap: 8px;
  padding-top: 4px;
  min-width: 0;
}
.school-name {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 0.74rem; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.07em;
  color: var(--text-muted);
}
.student-name {
  font-size: 1.7rem; font-weight: 700;
  line-height: 1.15;
  color: var(--text-primary);
  letter-spacing: -0.025em;
}
.status-badge-wrap {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
}
.badge { display: inline-flex; align-items: center; gap: 6px; }
.badge-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: currentColor;
}
.status-sub {
  font-size: 0.78rem;
  color: var(--text-muted);
  font-weight: 500;
}

/* ── Validity bar ──────────────────────────────────────────────────────────── */
.validity-bar {
  height: 4px;
  background: rgba(0,0,0,0.04);
  margin: 0 28px;
  border-radius: 999px;
  overflow: hidden;
}
.validity-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.6s ease;
}

/* ── Details ───────────────────────────────────────────────────────────────── */
.details-section {
  padding: 22px 28px 20px;
  border-top: 1px solid rgba(0,0,0,0.05);
  margin-top: 16px;
}
.section-label {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-muted);
  margin-bottom: 14px;
}
.details-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 10px;
}
:deep(.detail-item) {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 12px 14px;
  background: rgba(255,255,255,0.55);
  border: 1px solid rgba(255,255,255,0.7);
  border-radius: 14px;
}
:deep(.detail-icon) {
  width: 30px; height: 30px;
  border-radius: 9px;
  background: rgba(0,180,216,0.12);
  color: var(--accent-2);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
:deep(.detail-body) { flex: 1; min-width: 0; }
:deep(.detail-label) {
  font-size: 0.66rem; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.06em;
  color: var(--text-muted);
  margin-bottom: 3px;
}
:deep(.detail-value) {
  font-size: 0.9rem; font-weight: 600;
  color: var(--text-primary);
  word-break: break-word;
}
:deep(.detail-value.mono) { font-family: var(--font-mono); font-size: 0.82rem; }

/* ── Verify section ────────────────────────────────────────────────────────── */
.verify-section {
  padding: 22px 28px 22px;
  background: linear-gradient(180deg, rgba(0,180,216,0.04), rgba(6,214,160,0.04));
  border-top: 1px solid rgba(0,180,216,0.1);
  display: flex; flex-direction: column; gap: 16px;
}
.verify-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 14px;
}
.verify-stat {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 14px;
  background: rgba(255,255,255,0.6);
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,0.8);
}
.verify-stat-icon {
  width: 32px; height: 32px;
  border-radius: 10px;
  background: rgba(0,180,216,0.12);
  color: var(--accent-2);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.verify-stat-num {
  font-family: var(--font-mono);
  font-size: 1.3rem; font-weight: 700;
  color: var(--text-primary);
  line-height: 1;
}
.verify-stat-label {
  font-size: 0.7rem; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.06em;
  color: var(--text-muted);
  margin-top: 4px;
}

.copy-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  padding: 10px 14px;
  background: rgba(255,255,255,0.7);
  border: 1.5px solid rgba(0,180,216,0.2);
  color: var(--accent-2);
  border-radius: 12px;
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  transition: background var(--ease), transform 0.15s;
}
.copy-btn:hover { background: rgba(0,180,216,0.1); transform: translateY(-1px); }

.verified-badge {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 9px 16px;
  background: rgba(6,214,160,0.12);
  border: 1px solid rgba(6,214,160,0.28);
  border-radius: 999px;
  font-size: 0.82rem;
  font-weight: 700;
  color: #028a65;
  align-self: flex-start;
}

/* ── Footer strip ──────────────────────────────────────────────────────────── */
.card-footer {
  padding: 14px 28px;
  border-top: 1px solid rgba(0,0,0,0.05);
  display: flex; align-items: center; gap: 8px;
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--text-muted);
}
.footer-sep { opacity: 0.4; }

/* ── Back link ─────────────────────────────────────────────────────────────── */
.back-link { text-align: center; }
.back-link a {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 0.85rem;
  color: var(--text-muted);
  text-decoration: none;
}
.back-link a:hover { color: var(--accent); text-decoration: none; }

/* ── Mobile ────────────────────────────────────────────────────────────────── */
@media (max-width: 560px) {
  .card-header { flex-direction: column; align-items: center; text-align: center; gap: 16px; padding: 24px 20px 20px; }
  .header-info { align-items: center; }
  .student-name { font-size: 1.4rem; }
  .status-badge-wrap { justify-content: center; }
  .details-section, .verify-section, .card-footer { padding-left: 20px; padding-right: 20px; }
  .validity-bar { margin: 0 20px; }
  .details-grid { grid-template-columns: 1fr; }
  .verify-grid { grid-template-columns: 1fr; gap: 10px; }
  .verified-badge { align-self: center; }
  .card-footer { justify-content: center; flex-wrap: wrap; }
}
</style>
