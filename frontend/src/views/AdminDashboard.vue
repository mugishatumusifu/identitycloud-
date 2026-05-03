<template>
  <div class="admin-shell">
    <!-- ── Sidebar (desktop) / Top tab bar (mobile) ──────────────────────── -->
    <aside class="sidebar glass-card">
      <div class="brand">
        <div class="brand-icon"><Icon name="shield-check" :size="20" /></div>
        <div class="brand-text">
          <div class="brand-title">Identity Cloud</div>
          <div class="brand-sub">Admin Console</div>
        </div>
      </div>

      <nav class="nav">
        <button
          v-for="item in navItems"
          :key="item.key"
          class="nav-item"
          :class="{ active: tab === item.key }"
          @click="goTab(item.key)"
        >
          <Icon :name="item.icon" :size="18" />
          <span class="nav-label">{{ item.label }}</span>
        </button>
      </nav>

      <div class="sidebar-footer">
        <div class="user-chip">
          <div class="user-avatar"><Icon name="user" :size="14" /></div>
          <div class="user-info">
            <div class="user-name">{{ adminUser }}</div>
            <div class="user-role">Administrator</div>
          </div>
        </div>
        <button class="logout-btn" @click="logout" title="Sign out">
          <Icon name="logout" :size="16" />
        </button>
      </div>
    </aside>

    <!-- ── Main content ──────────────────────────────────────────────────── -->
    <main class="content">
      <!-- Header bar -->
      <header class="content-header">
        <div>
          <div class="crumbs" v-if="activeSchool">
            <button class="crumb-btn" @click="exitSchool">
              <Icon name="arrow-left" :size="14" /> Schools
            </button>
            <span class="crumb-sep">/</span>
            <span class="crumb-current">{{ activeSchool.school.name }}</span>
          </div>
          <h1 class="page-title">{{ pageTitle }}</h1>
          <p class="page-sub">{{ pageSub }}</p>
        </div>
        <button class="refresh-btn" @click="refresh" :disabled="loading">
          <Icon name="refresh" :size="16" :class="{ spinning: loading }" />
          <span>Refresh</span>
        </button>
      </header>

      <!-- ── OVERVIEW ───────────────────────────────────────────────────── -->
      <section v-if="tab === 'overview'" class="tab-pane">
        <div class="kpi-grid">
          <div class="kpi-card glass-card" v-for="k in kpis" :key="k.label" :style="{ '--kc': k.color }">
            <div class="kpi-icon"><Icon :name="k.icon" :size="20" /></div>
            <div>
              <div class="kpi-num">{{ k.value }}</div>
              <div class="kpi-label">{{ k.label }}</div>
            </div>
          </div>
        </div>

        <div class="panel glass-card">
          <div class="panel-header">
            <Icon name="activity" :size="16" />
            <span>Recent Activity</span>
          </div>
          <div class="activity-list">
            <div v-if="!overview?.recentActivity?.length" class="empty-row">No activity yet.</div>
            <div v-for="(log, i) in overview?.recentActivity || []" :key="i" class="activity-row">
              <div class="activity-dot" :class="`dot-${log.action?.toLowerCase()}`"></div>
              <div class="activity-body">
                <div class="activity-msg">{{ log.message }}</div>
                <div class="activity-meta">
                  <span class="tag">{{ log.action }}</span>
                  <span class="tag tag-soft">{{ log.entity }}</span>
                  <span class="time">{{ formatTime(log.timestamp) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ── SCHOOLS LIST ───────────────────────────────────────────────── -->
      <section v-else-if="tab === 'schools' && !activeSchool" class="tab-pane">
        <div class="toolbar">
          <div class="search-wrap">
            <Icon name="search" :size="16" />
            <input v-model="schoolSearch" type="text" placeholder="Search schools…" />
          </div>
          <div class="count-chip">{{ filteredSchools.length }} school{{ filteredSchools.length === 1 ? '' : 's' }}</div>
        </div>

        <div v-if="loading && !schools.length" class="loading-block"><div class="spinner"></div></div>

        <div v-else-if="!filteredSchools.length" class="empty-state glass-card">
          <Icon name="school" :size="32" />
          <h3>No schools yet</h3>
          <p>Schools appear here as soon as they're published from Card Studio.</p>
        </div>

        <div v-else class="schools-grid">
          <div v-for="s in filteredSchools" :key="s.slug" class="school-card glass-card">
            <div class="school-card-top" :style="{ background: `linear-gradient(135deg, ${s.themeColor || '#00b4d8'}, ${s.themeColor || '#00b4d8'}88)` }">
              <div class="school-logo-mini">
                <img v-if="s.logo" :src="s.logo" :alt="s.name" />
                <Icon v-else name="school" :size="22" />
              </div>
              <div class="school-counts">
                <div><strong>{{ s.studentCount }}</strong><span>students</span></div>
                <div><strong>{{ s.activeCount }}</strong><span>active</span></div>
              </div>
            </div>
            <div class="school-card-body">
              <h3 class="school-card-name">{{ s.name }}</h3>
              <code class="school-card-slug">{{ s.slug }}</code>
              <div class="school-card-actions">
                <button class="action-btn primary" @click="enterSchool(s.slug)">
                  <Icon name="switch" :size="14" /> Manage
                </button>
                <button class="action-btn ghost" @click="openEditSchool(s)" title="Edit">
                  <Icon name="pencil" :size="14" />
                </button>
                <button class="action-btn danger" @click="confirmDeleteSchool(s)" title="Delete">
                  <Icon name="trash" :size="14" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ── SCHOOL DETAIL ─────────────────────────────────────────────── -->
      <section v-else-if="tab === 'schools' && activeSchool" class="tab-pane">
        <div class="school-header-card glass-card">
          <div class="sh-left" :style="{ background: `linear-gradient(135deg, ${activeSchool.school.themeColor || '#00b4d8'}, ${activeSchool.school.themeColor || '#00b4d8'}88)` }">
            <img v-if="activeSchool.school.logo" :src="activeSchool.school.logo" :alt="activeSchool.school.name" />
            <Icon v-else name="school" :size="28" />
          </div>
          <div class="sh-right">
            <div class="sh-meta-row">
              <code class="mono-chip">{{ activeSchool.school.slug }}</code>
              <span class="badge badge-active">{{ activeSchool.students.length }} students</span>
            </div>
            <h2 class="sh-name">{{ activeSchool.school.name }}</h2>
            <div class="sh-actions">
              <button class="action-btn ghost" @click="openEditSchool(activeSchool.school)">
                <Icon name="pencil" :size="14" /> Edit school
              </button>
              <a class="action-btn ghost" :href="`/${activeSchool.school.slug}`" target="_blank" rel="noopener">
                <Icon name="link" :size="14" /> Open public page
              </a>
              <button class="action-btn danger" @click="confirmDeleteSchool(activeSchool.school)">
                <Icon name="trash" :size="14" /> Delete school
              </button>
            </div>
          </div>
        </div>

        <div class="toolbar">
          <div class="search-wrap">
            <Icon name="search" :size="16" />
            <input v-model="studentSearch" type="text" placeholder="Search students…" />
          </div>
          <select v-model="studentFilter" class="filter-select">
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="expired">Expired</option>
            <option value="revoked">Revoked</option>
          </select>
        </div>

        <div v-if="!filteredStudents.length" class="empty-state glass-card">
          <Icon name="users" :size="28" />
          <h3>No students match</h3>
          <p>Try a different search or filter.</p>
        </div>

        <div v-else class="students-list">
          <div v-for="st in filteredStudents" :key="st.studentId" class="student-row glass-card">
            <div class="sr-avatar" :style="{ background: avatarColor(st.fullName) }">
              <img v-if="st.photoUrl" :src="st.photoUrl" :alt="st.fullName" />
              <span v-else>{{ initials(st.fullName) }}</span>
            </div>
            <div class="sr-info">
              <div class="sr-name-line">
                <span class="sr-name">{{ st.fullName }}</span>
                <span class="badge" :class="`badge-${st.status}`">{{ st.status }}</span>
              </div>
              <div class="sr-meta">
                <span class="sr-meta-item"><Icon name="hash" :size="12" />{{ st.studentId }}</span>
                <span v-if="st.class" class="sr-meta-item"><Icon name="graduate" :size="12" />{{ st.class }}</span>
                <span v-if="st.expiresAt" class="sr-meta-item"><Icon name="calendar" :size="12" />Expires {{ formatDate(st.expiresAt) }}</span>
                <span class="sr-meta-item"><Icon name="scan" :size="12" />{{ st.scanCount || 0 }} scans</span>
              </div>
            </div>
            <div class="sr-actions">
              <a class="icon-btn" :href="`/${activeSchool.school.slug}/${encodeURIComponent(st.studentId)}`" target="_blank" rel="noopener" title="View ID">
                <Icon name="eye" :size="15" />
              </a>
              <button class="icon-btn" @click="openEditStudent(st)" title="Edit">
                <Icon name="pencil" :size="15" />
              </button>
              <button
                class="icon-btn"
                :class="st.status === 'revoked' ? 'success' : 'warn'"
                @click="toggleRevoke(st)"
                :title="st.status === 'revoked' ? 'Restore' : 'Revoke'"
              >
                <Icon :name="st.status === 'revoked' ? 'check-circle' : 'x-circle'" :size="15" />
              </button>
              <button class="icon-btn danger" @click="confirmDeleteStudent(st)" title="Delete">
                <Icon name="trash" :size="15" />
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- ── LOGS ─────────────────────────────────────────────────────── -->
      <section v-else-if="tab === 'logs'" class="tab-pane">
        <div v-if="!logs.length" class="empty-state glass-card">
          <Icon name="list" :size="28" />
          <h3>No logs yet</h3>
        </div>
        <div v-else class="panel glass-card">
          <div class="activity-list">
            <div v-for="(log, i) in logs" :key="i" class="activity-row">
              <div class="activity-dot" :class="`dot-${log.action?.toLowerCase()}`"></div>
              <div class="activity-body">
                <div class="activity-msg">{{ log.message }}</div>
                <div class="activity-meta">
                  <span class="tag">{{ log.action }}</span>
                  <span class="tag tag-soft">{{ log.entity }}</span>
                  <span class="time">{{ formatTime(log.timestamp) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>

    <!-- ── Edit School modal ────────────────────────────────────────────── -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="editSchool" class="modal-backdrop" @click.self="editSchool = null">
          <div class="modal-card form-modal">
            <div class="modal-head">
              <h3>Edit school</h3>
              <button class="icon-btn" @click="editSchool = null"><Icon name="x" :size="16" /></button>
            </div>
            <label class="form-field">
              <span>School name</span>
              <input v-model="editSchool.name" type="text" />
            </label>
            <label class="form-field">
              <span>Theme color</span>
              <div class="color-input-row">
                <input type="color" v-model="editSchool.themeColor" />
                <input type="text" v-model="editSchool.themeColor" placeholder="#00b4d8" />
              </div>
            </label>
            <div class="modal-actions">
              <button class="btn-ghost" @click="editSchool = null">Cancel</button>
              <button class="btn-primary" :disabled="saving" @click="saveEditSchool">
                <span v-if="saving" class="spinner-sm"></span>
                Save changes
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- ── Edit Student modal ───────────────────────────────────────────── -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="editStudent" class="modal-backdrop" @click.self="editStudent = null">
          <div class="modal-card form-modal">
            <div class="modal-head">
              <h3>Edit student</h3>
              <button class="icon-btn" @click="editStudent = null"><Icon name="x" :size="16" /></button>
            </div>
            <label class="form-field">
              <span>Full name</span>
              <input v-model="editStudent.fullName" type="text" />
            </label>
            <label class="form-field">
              <span>Class</span>
              <input v-model="editStudent.class" type="text" placeholder="e.g. Grade 10A" />
            </label>
            <label class="form-field">
              <span>Status</span>
              <select v-model="editStudent.status">
                <option value="active">Active</option>
                <option value="expired">Expired</option>
                <option value="revoked">Revoked</option>
              </select>
            </label>
            <label class="form-field">
              <span>Expires at</span>
              <input v-model="editStudent.expiresAtLocal" type="date" />
            </label>
            <div class="modal-actions">
              <button class="btn-ghost" @click="editStudent = null">Cancel</button>
              <button class="btn-primary" :disabled="saving" @click="saveEditStudent">
                <span v-if="saving" class="spinner-sm"></span>
                Save changes
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- ── Confirm modal ───────────────────────────────────────────────── -->
    <ConfirmModal
      :open="!!confirmAction"
      :title="confirmAction?.title || ''"
      :message="confirmAction?.message || ''"
      :confirm-label="confirmAction?.label || 'Delete'"
      :loading="confirmLoading"
      @cancel="confirmAction = null"
      @confirm="runConfirm"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import Icon from '@/components/Icon.vue'
import ConfirmModal from '@/components/admin/ConfirmModal.vue'

const router    = useRouter()
const adminUser = ref(localStorage.getItem('ic_admin_user') || 'admin')

// Authed axios instance
const api = axios.create()
api.interceptors.request.use(cfg => {
  const t = localStorage.getItem('ic_admin_token')
  if (t) cfg.headers.Authorization = `Bearer ${t}`
  return cfg
})
api.interceptors.response.use(r => r, err => {
  if (err?.response?.status === 401) {
    localStorage.removeItem('ic_admin_token')
    router.replace({ name: 'admin-login' })
  }
  return Promise.reject(err)
})

// ── State ──────────────────────────────────────────────────────────────────
const tab           = ref('overview')
const loading       = ref(false)
const overview      = ref(null)
const schools       = ref([])
const logs          = ref([])
const activeSchool  = ref(null)        // { school, students }
const schoolSearch  = ref('')
const studentSearch = ref('')
const studentFilter = ref('')

const editSchool   = ref(null)
const editStudent  = ref(null)
const saving       = ref(false)
const confirmAction = ref(null)
const confirmLoading = ref(false)

const navItems = [
  { key: 'overview', label: 'Overview', icon: 'sparkles' },
  { key: 'schools',  label: 'Schools',  icon: 'school' },
  { key: 'logs',     label: 'Activity', icon: 'activity' },
]

const pageTitle = computed(() => {
  if (activeSchool.value) return activeSchool.value.school.name
  if (tab.value === 'overview') return 'Dashboard Overview'
  if (tab.value === 'schools')  return 'Schools'
  if (tab.value === 'logs')     return 'Activity Log'
  return ''
})
const pageSub = computed(() => {
  if (activeSchool.value) return 'Manage classes, students and identity status.'
  if (tab.value === 'overview') return 'Real-time stats and recent activity across Identity Cloud.'
  if (tab.value === 'schools')  return 'Browse, edit, switch into and delete schools.'
  if (tab.value === 'logs')     return 'Audit trail of every publish, scan and admin action.'
  return ''
})

const kpis = computed(() => {
  const t = overview.value?.totals || {}
  return [
    { label: 'Schools',         value: t.schools  ?? 0, icon: 'building',     color: '#00b4d8' },
    { label: 'Students',        value: t.students ?? 0, icon: 'users',        color: '#0077b6' },
    { label: 'Active IDs',      value: t.active   ?? 0, icon: 'check-circle', color: '#06d6a0' },
    { label: 'Expired',         value: t.expired  ?? 0, icon: 'hourglass',    color: '#ef476f' },
    { label: 'Revoked',         value: t.revoked  ?? 0, icon: 'x-circle',     color: '#ff9500' },
    { label: 'Scans (24h)',     value: t.scans24h ?? 0, icon: 'scan',         color: '#7b61ff' },
  ]
})

const filteredSchools = computed(() => {
  const q = schoolSearch.value.trim().toLowerCase()
  if (!q) return schools.value
  return schools.value.filter(s =>
    (s.name || '').toLowerCase().includes(q) ||
    (s.slug || '').toLowerCase().includes(q)
  )
})
const filteredStudents = computed(() => {
  if (!activeSchool.value) return []
  let arr = activeSchool.value.students
  if (studentFilter.value) arr = arr.filter(s => s.status === studentFilter.value)
  const q = studentSearch.value.trim().toLowerCase()
  if (q) {
    arr = arr.filter(s =>
      (s.fullName  || '').toLowerCase().includes(q) ||
      (s.studentId || '').toLowerCase().includes(q) ||
      (s.class     || '').toLowerCase().includes(q)
    )
  }
  return arr
})

// ── Fetchers ───────────────────────────────────────────────────────────────
async function loadOverview() {
  const { data } = await api.get('/api/admin/overview')
  overview.value = data
}
async function loadSchools() {
  const { data } = await api.get('/api/admin/schools')
  schools.value = data
}
async function loadLogs() {
  const { data } = await api.get('/api/admin/logs?limit=200')
  logs.value = data
}
async function loadActiveSchool(slug) {
  const { data } = await api.get(`/api/admin/schools/${encodeURIComponent(slug)}`)
  activeSchool.value = data
}

async function refresh() {
  loading.value = true
  try {
    if (activeSchool.value) await loadActiveSchool(activeSchool.value.school.slug)
    else if (tab.value === 'overview') await loadOverview()
    else if (tab.value === 'schools')  await loadSchools()
    else if (tab.value === 'logs')     await loadLogs()
  } finally { loading.value = false }
}

function goTab(k) {
  tab.value = k
  activeSchool.value = null
  refresh()
}
async function enterSchool(slug) { loading.value = true; try { await loadActiveSchool(slug) } finally { loading.value = false } }
function exitSchool() { activeSchool.value = null; refresh() }

function logout() {
  localStorage.removeItem('ic_admin_token')
  localStorage.removeItem('ic_admin_user')
  router.push({ name: 'admin-login' })
}

// ── School edit / delete ──────────────────────────────────────────────────
function openEditSchool(s) {
  editSchool.value = { slug: s.slug, name: s.name || '', themeColor: s.themeColor || '#00b4d8' }
}
async function saveEditSchool() {
  saving.value = true
  try {
    await api.patch(`/api/admin/schools/${encodeURIComponent(editSchool.value.slug)}`, {
      name: editSchool.value.name,
      themeColor: editSchool.value.themeColor,
    })
    editSchool.value = null
    await Promise.all([loadSchools(), activeSchool.value ? loadActiveSchool(activeSchool.value.school.slug) : null])
  } catch (e) { alert(e?.response?.data?.error || 'Failed to save') }
  finally { saving.value = false }
}
function confirmDeleteSchool(s) {
  confirmAction.value = {
    title: `Delete ${s.name}?`,
    message: 'This will permanently remove the school and ALL its students, photos, and identities. This cannot be undone.',
    label: 'Delete school',
    run: async () => {
      await api.delete(`/api/admin/schools/${encodeURIComponent(s.slug)}`)
      activeSchool.value = null
      await loadSchools()
    },
  }
}

// ── Student edit / revoke / delete ────────────────────────────────────────
function openEditStudent(st) {
  editStudent.value = {
    studentId: st.studentId,
    fullName: st.fullName || '',
    class: st.class || '',
    status: st.status || 'active',
    expiresAtLocal: st.expiresAt ? new Date(st.expiresAt).toISOString().slice(0, 10) : '',
  }
}
async function saveEditStudent() {
  saving.value = true
  try {
    const payload = {
      fullName: editStudent.value.fullName,
      class:    editStudent.value.class || null,
      status:   editStudent.value.status,
      expiresAt: editStudent.value.expiresAtLocal ? new Date(editStudent.value.expiresAtLocal).toISOString() : null,
    }
    await api.patch(
      `/api/admin/schools/${encodeURIComponent(activeSchool.value.school.slug)}/students/${encodeURIComponent(editStudent.value.studentId)}`,
      payload
    )
    editStudent.value = null
    await loadActiveSchool(activeSchool.value.school.slug)
  } catch (e) { alert(e?.response?.data?.error || 'Failed to save') }
  finally { saving.value = false }
}
async function toggleRevoke(st) {
  const action = st.status === 'revoked' ? 'restore' : 'revoke'
  await api.post(`/api/admin/schools/${encodeURIComponent(activeSchool.value.school.slug)}/students/${encodeURIComponent(st.studentId)}/${action}`)
  await loadActiveSchool(activeSchool.value.school.slug)
}
function confirmDeleteStudent(st) {
  confirmAction.value = {
    title: `Delete ${st.fullName}?`,
    message: `Permanently remove student ${st.studentId}. The QR will stop verifying immediately.`,
    label: 'Delete student',
    run: async () => {
      await api.delete(`/api/admin/schools/${encodeURIComponent(activeSchool.value.school.slug)}/students/${encodeURIComponent(st.studentId)}`)
      await loadActiveSchool(activeSchool.value.school.slug)
    },
  }
}
async function runConfirm() {
  if (!confirmAction.value) return
  confirmLoading.value = true
  try { await confirmAction.value.run(); confirmAction.value = null }
  catch (e) { alert(e?.response?.data?.error || 'Action failed') }
  finally { confirmLoading.value = false }
}

// ── Helpers ───────────────────────────────────────────────────────────────
function initials(name) {
  return (name || '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}
const COLORS = ['#00b4d8', '#0077b6', '#06d6a0', '#118ab2', '#7b61ff', '#ff9500']
function avatarColor(name) {
  const i = ((name || 'A').charCodeAt(0)) % COLORS.length
  return `linear-gradient(135deg, ${COLORS[i]}, ${COLORS[(i + 2) % COLORS.length]})`
}
function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
function formatTime(iso) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'Just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// ── Init ──────────────────────────────────────────────────────────────────
onMounted(async () => {
  loading.value = true
  try {
    await api.get('/api/admin/me') // validate token
    await Promise.all([loadOverview(), loadSchools(), loadLogs()])
  } catch (_) { /* 401 handled by interceptor */ }
  finally { loading.value = false }
})
</script>

<style scoped>
.admin-shell {
  display: grid;
  grid-template-columns: 260px 1fr;
  gap: 20px;
  min-height: calc(100vh - 80px);
  padding: 0 20px 32px;
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
}

/* ── Sidebar ─────────────────────────────────────────────────────────────── */
.sidebar {
  position: sticky;
  top: 80px;
  align-self: start;
  height: fit-content;
  max-height: calc(100vh - 100px);
  padding: 22px 18px;
  display: flex;
  flex-direction: column;
  gap: 22px;
  border-radius: 22px;
}
.brand { display: flex; align-items: center; gap: 12px; }
.brand-icon {
  width: 40px; height: 40px;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  color: #fff;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.brand-title { font-weight: 700; font-size: 0.95rem; color: var(--text-primary); }
.brand-sub   { font-size: 0.7rem; color: var(--text-muted); letter-spacing: 0.06em; text-transform: uppercase; }

.nav { display: flex; flex-direction: column; gap: 4px; }
.nav-item {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px;
  background: transparent;
  border: none;
  border-radius: 10px;
  color: var(--text-secondary);
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  text-align: left;
  transition: background var(--ease), color var(--ease);
}
.nav-item:hover { background: rgba(0,180,216,0.08); color: var(--accent-2); }
.nav-item.active { background: linear-gradient(135deg, rgba(0,180,216,0.18), rgba(0,119,182,0.12)); color: var(--accent-2); }

.sidebar-footer {
  margin-top: auto;
  display: flex; align-items: center; gap: 8px;
  padding-top: 14px;
  border-top: 1px solid rgba(0,0,0,0.06);
}
.user-chip { flex: 1; display: flex; align-items: center; gap: 10px; min-width: 0; }
.user-avatar {
  width: 32px; height: 32px;
  border-radius: 10px;
  background: rgba(0,180,216,0.15);
  color: var(--accent-2);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.user-info { min-width: 0; }
.user-name { font-weight: 700; font-size: 0.85rem; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.user-role { font-size: 0.7rem; color: var(--text-muted); }
.logout-btn {
  width: 36px; height: 36px;
  border-radius: 10px;
  border: none;
  background: rgba(239,71,111,0.1);
  color: #c0264b;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}
.logout-btn:hover { background: rgba(239,71,111,0.18); }

/* ── Content ─────────────────────────────────────────────────────────────── */
.content { min-width: 0; }
.content-header {
  display: flex; align-items: flex-end; justify-content: space-between;
  gap: 16px; padding: 8px 4px 18px;
  flex-wrap: wrap;
}
.crumbs { display: flex; align-items: center; gap: 6px; font-size: 0.78rem; color: var(--text-muted); margin-bottom: 6px; }
.crumb-btn {
  display: inline-flex; align-items: center; gap: 4px;
  background: transparent; border: none; cursor: pointer;
  color: var(--text-muted); font-size: 0.78rem; padding: 0;
}
.crumb-btn:hover { color: var(--accent-2); }
.crumb-current { color: var(--text-primary); font-weight: 600; }

.page-title {
  font-size: 1.5rem; font-weight: 700; letter-spacing: -0.02em;
  color: var(--text-primary);
}
.page-sub { font-size: 0.88rem; color: var(--text-muted); margin-top: 2px; }
.refresh-btn {
  display: inline-flex; align-items: center; gap: 6px;
  background: rgba(255,255,255,0.7);
  border: 1.5px solid rgba(0,180,216,0.18);
  color: var(--accent-2);
  padding: 8px 14px;
  border-radius: 10px;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.85rem;
}
.refresh-btn:hover:not(:disabled) { background: rgba(0,180,216,0.1); }
.spinning { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.tab-pane { display: flex; flex-direction: column; gap: 18px; }

/* ── KPI grid ────────────────────────────────────────────────────────────── */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 14px;
}
.kpi-card {
  padding: 18px;
  display: flex; align-items: center; gap: 14px;
  border-radius: 18px;
  border-top: 3px solid var(--kc, var(--accent));
}
.kpi-icon {
  width: 42px; height: 42px;
  border-radius: 12px;
  background: color-mix(in oklab, var(--kc, var(--accent)) 18%, transparent);
  color: var(--kc, var(--accent));
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.kpi-num { font-size: 1.6rem; font-weight: 700; color: var(--text-primary); font-family: var(--font-mono); line-height: 1; }
.kpi-label { font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em; font-weight: 600; margin-top: 4px; }

/* ── Panels ──────────────────────────────────────────────────────────────── */
.panel { padding: 4px; border-radius: 18px; overflow: hidden; }
.panel-header {
  display: flex; align-items: center; gap: 8px;
  padding: 14px 18px;
  border-bottom: 1px solid rgba(0,0,0,0.05);
  font-weight: 700; font-size: 0.85rem;
  color: var(--text-primary);
}

.activity-list { padding: 6px 4px; }
.activity-row {
  display: flex; gap: 12px;
  padding: 12px 14px;
  border-bottom: 1px solid rgba(0,0,0,0.04);
}
.activity-row:last-child { border-bottom: none; }
.activity-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: var(--accent);
  margin-top: 7px;
  flex-shrink: 0;
}
.dot-publish, .dot-update, .dot-restore { background: var(--accent); }
.dot-scan { background: var(--accent-green); }
.dot-delete, .dot-revoke { background: #ef476f; }
.dot-login { background: #7b61ff; }
.activity-body { flex: 1; min-width: 0; }
.activity-msg { font-size: 0.88rem; color: var(--text-primary); font-weight: 500; }
.activity-meta {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  margin-top: 4px;
  font-size: 0.72rem; color: var(--text-muted);
}
.tag {
  background: rgba(0,180,216,0.1);
  color: var(--accent-2);
  padding: 2px 8px;
  border-radius: 6px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  font-size: 0.65rem;
}
.tag-soft { background: rgba(0,0,0,0.05); color: var(--text-muted); }
.empty-row { padding: 24px; text-align: center; color: var(--text-muted); font-size: 0.9rem; }

/* ── Toolbar ─────────────────────────────────────────────────────────────── */
.toolbar { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.search-wrap {
  flex: 1; min-width: 200px;
  display: flex; align-items: center; gap: 8px;
  background: rgba(255,255,255,0.85);
  border: 1.5px solid rgba(0,180,216,0.18);
  border-radius: 12px;
  padding: 0 12px;
  color: var(--text-muted);
}
.search-wrap:focus-within { border-color: var(--accent); box-shadow: 0 0 0 4px var(--accent-glow); }
.search-wrap input {
  flex: 1;
  border: none; outline: none; background: transparent;
  padding: 11px 0; font-size: 0.9rem; color: var(--text-primary);
}
.filter-select {
  padding: 11px 14px;
  border-radius: 12px;
  border: 1.5px solid rgba(0,180,216,0.18);
  background: rgba(255,255,255,0.85);
  font-size: 0.88rem; color: var(--text-primary);
}
.count-chip {
  padding: 6px 12px;
  background: rgba(0,180,216,0.1);
  color: var(--accent-2);
  font-size: 0.78rem; font-weight: 700;
  border-radius: 999px;
}

/* ── Schools grid ────────────────────────────────────────────────────────── */
.schools-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}
.school-card {
  border-radius: 18px;
  overflow: hidden;
  display: flex; flex-direction: column;
  transition: transform var(--transition), box-shadow var(--ease);
}
.school-card:hover { transform: translateY(-3px); box-shadow: 0 16px 40px -12px rgba(0,60,100,0.18); }
.school-card-top {
  padding: 18px;
  color: #fff;
  display: flex; justify-content: space-between; align-items: flex-start;
  min-height: 92px;
}
.school-logo-mini {
  width: 44px; height: 44px;
  border-radius: 12px;
  background: rgba(255,255,255,0.25);
  backdrop-filter: blur(6px);
  display: flex; align-items: center; justify-content: center;
  overflow: hidden;
}
.school-logo-mini img { width: 100%; height: 100%; object-fit: cover; }
.school-counts { display: flex; gap: 16px; text-align: right; font-size: 0.72rem; }
.school-counts strong { font-size: 1.1rem; display: block; }
.school-counts span { opacity: 0.85; text-transform: uppercase; letter-spacing: 0.04em; }
.school-card-body { padding: 14px 16px 16px; display: flex; flex-direction: column; gap: 8px; }
.school-card-name { font-size: 1rem; font-weight: 700; color: var(--text-primary); }
.school-card-slug {
  font-family: var(--font-mono); font-size: 0.75rem;
  color: var(--text-muted);
  background: rgba(0,0,0,0.04);
  padding: 2px 8px; border-radius: 6px;
  align-self: flex-start;
}
.school-card-actions { display: flex; gap: 6px; margin-top: 6px; }

.action-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 12px;
  border-radius: 10px;
  border: none;
  font-weight: 600; font-size: 0.82rem;
  cursor: pointer;
  text-decoration: none;
  transition: background 0.15s, transform 0.1s;
}
.action-btn.primary { flex: 1; background: var(--accent); color: #fff; justify-content: center; }
.action-btn.primary:hover { background: var(--accent-2); }
.action-btn.ghost { background: rgba(0,0,0,0.04); color: var(--text-secondary); }
.action-btn.ghost:hover { background: rgba(0,0,0,0.08); }
.action-btn.danger { background: rgba(239,71,111,0.1); color: #c0264b; }
.action-btn.danger:hover { background: rgba(239,71,111,0.18); }

/* ── School header (in detail view) ──────────────────────────────────────── */
.school-header-card {
  border-radius: 22px;
  overflow: hidden;
  display: flex;
  align-items: stretch;
}
.sh-left {
  width: 110px;
  display: flex; align-items: center; justify-content: center;
  color: #fff;
  flex-shrink: 0;
}
.sh-left img { width: 56px; height: 56px; border-radius: 14px; object-fit: cover; }
.sh-right {
  flex: 1;
  padding: 18px 22px;
  display: flex; flex-direction: column; gap: 8px;
}
.sh-meta-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.mono-chip {
  font-family: var(--font-mono); font-size: 0.72rem;
  background: rgba(0,180,216,0.1); color: var(--accent-2);
  padding: 3px 10px; border-radius: 6px;
}
.sh-name { font-size: 1.5rem; font-weight: 700; color: var(--text-primary); }
.sh-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 6px; }

/* ── Students list ──────────────────────────────────────────────────────── */
.students-list { display: flex; flex-direction: column; gap: 8px; }
.student-row {
  display: flex; align-items: center; gap: 14px;
  padding: 12px 16px;
  border-radius: 16px;
}
.sr-avatar {
  width: 42px; height: 42px;
  border-radius: 12px;
  color: #fff; font-weight: 700; font-size: 0.85rem;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
}
.sr-avatar img { width: 100%; height: 100%; object-fit: cover; }
.sr-info { flex: 1; min-width: 0; }
.sr-name-line { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.sr-name { font-weight: 700; font-size: 0.95rem; color: var(--text-primary); }
.sr-meta {
  display: flex; flex-wrap: wrap; gap: 12px;
  margin-top: 4px;
  font-size: 0.78rem; color: var(--text-muted);
}
.sr-meta-item { display: inline-flex; align-items: center; gap: 4px; }
.sr-actions { display: flex; gap: 4px; flex-shrink: 0; }
.icon-btn {
  width: 34px; height: 34px;
  border-radius: 9px;
  border: none;
  background: rgba(0,0,0,0.04);
  color: var(--text-secondary);
  cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  text-decoration: none;
  transition: background 0.15s, color 0.15s;
}
.icon-btn:hover { background: rgba(0,180,216,0.12); color: var(--accent-2); }
.icon-btn.warn:hover { background: rgba(255,149,0,0.15); color: #b26200; }
.icon-btn.success:hover { background: rgba(6,214,160,0.15); color: #028a65; }
.icon-btn.danger:hover { background: rgba(239,71,111,0.15); color: #c0264b; }

/* ── Empty state ─────────────────────────────────────────────────────────── */
.empty-state {
  padding: 48px 24px;
  text-align: center;
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  color: var(--text-muted);
  border-radius: 18px;
}
.empty-state h3 { color: var(--text-primary); font-size: 1.05rem; }
.empty-state p  { font-size: 0.88rem; max-width: 320px; }
.loading-block { display: flex; justify-content: center; padding: 60px; }

/* ── Modals ──────────────────────────────────────────────────────────────── */
.modal-backdrop {
  position: fixed; inset: 0;
  background: rgba(10,25,45,0.55);
  backdrop-filter: blur(6px);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000;
  padding: 16px;
}
.modal-card.form-modal {
  background: #fff;
  border-radius: 18px;
  padding: 22px;
  max-width: 440px;
  width: 100%;
  box-shadow: 0 30px 80px -20px rgba(0,40,80,0.4);
  display: flex; flex-direction: column; gap: 14px;
}
.modal-head { display: flex; align-items: center; justify-content: space-between; }
.modal-head h3 { font-size: 1.1rem; font-weight: 700; }
.form-field { display: flex; flex-direction: column; gap: 5px; }
.form-field span {
  font-size: 0.72rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.06em; color: var(--text-muted);
}
.form-field input, .form-field select {
  padding: 10px 12px; border-radius: 10px;
  border: 1.5px solid rgba(0,180,216,0.18);
  background: #fff;
  font-family: var(--font-body); font-size: 0.92rem;
  color: var(--text-primary);
}
.form-field input:focus, .form-field select:focus {
  outline: none; border-color: var(--accent);
  box-shadow: 0 0 0 4px var(--accent-glow);
}
.color-input-row { display: flex; gap: 8px; }
.color-input-row input[type=color] { width: 50px; padding: 0; border-radius: 10px; cursor: pointer; }
.modal-actions { display: flex; gap: 10px; margin-top: 6px; }
.btn-ghost, .btn-primary {
  flex: 1;
  padding: 11px 16px;
  border-radius: 11px; border: none;
  font-weight: 600; font-size: 0.9rem;
  cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  transition: background 0.2s, transform 0.15s;
}
.btn-ghost { background: #f0f4f8; color: #506680; }
.btn-ghost:hover { background: #e3eaf2; }
.btn-primary { background: var(--accent); color: #fff; }
.btn-primary:hover:not(:disabled) { background: var(--accent-2); }
.btn-primary:disabled { opacity: 0.6; cursor: default; }
.spinner-sm {
  width: 14px; height: 14px;
  border: 2px solid rgba(255,255,255,0.4);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.modal-enter-active, .modal-leave-active { transition: opacity 0.2s; }
.modal-enter-from, .modal-leave-to { opacity: 0; }

/* ── Mobile ─────────────────────────────────────────────────────────────── */
@media (max-width: 900px) {
  .admin-shell {
    grid-template-columns: 1fr;
    padding: 0 14px 24px;
  }
  .sidebar {
    position: relative;
    top: 0;
    flex-direction: row;
    align-items: center;
    padding: 12px 14px;
    overflow-x: auto;
    max-height: none;
  }
  .brand { flex-shrink: 0; }
  .brand-text { display: none; }
  .nav { flex-direction: row; gap: 4px; flex: 1; }
  .nav-item { padding: 8px 12px; }
  .nav-label { display: none; }
  .sidebar-footer { padding-top: 0; border-top: none; border-left: 1px solid rgba(0,0,0,0.08); padding-left: 12px; margin-top: 0; }
  .user-info { display: none; }
}
@media (max-width: 600px) {
  .sh-left { width: 80px; }
  .sh-left img { width: 44px; height: 44px; }
  .sh-name { font-size: 1.2rem; }
  .student-row { flex-wrap: wrap; }
  .sr-actions { width: 100%; justify-content: flex-end; }
  .page-title { font-size: 1.25rem; }
  .kpi-num { font-size: 1.3rem; }
}
</style>
