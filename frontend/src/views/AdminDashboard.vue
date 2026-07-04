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
          <div class="crumbs" v-if="activeOrg">
            <button class="crumb-btn" @click="exitOrg">
              <Icon name="arrow-left" :size="14" /> Organizations
            </button>
            <span class="crumb-sep">/</span>
            <span class="crumb-current">{{ activeOrg.org.name }}</span>
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

      <!-- ── ORGANIZATIONS LIST ─────────────────────────────────────────── -->
      <section v-else-if="tab === 'orgs' && !activeOrg" class="tab-pane">
        <div class="toolbar">
          <div class="search-wrap">
            <Icon name="search" :size="16" />
            <input v-model="orgSearch" type="text" placeholder="Search organizations…" />
          </div>
          <div class="count-chip">{{ filteredOrgs.length }} organization{{ filteredOrgs.length === 1 ? '' : 's' }}</div>
        </div>

        <div v-if="loading && !orgs.length" class="loading-block"><div class="spinner"></div></div>

        <div v-else-if="!filteredOrgs.length" class="empty-state glass-card">
          <Icon name="company" :size="32" />
          <h3>No organizations yet</h3>
          <p>Organizations appear here as soon as they're published from Card Studio.</p>
        </div>

        <div v-else class="schools-grid">
          <div v-for="o in filteredOrgs" :key="o.slug" class="school-card glass-card">
            <div class="school-card-top" :style="{ background: `linear-gradient(135deg, ${o.themeColor || '#00b4d8'}, ${o.themeColor || '#00b4d8'}88)` }">
              <div class="school-logo-mini">
                <img v-if="o.logo" :src="o.logo" :alt="o.name" />
                <Icon v-else :name="getIndustryIcon(o.industry)" :size="22" />
              </div>
              <div class="school-counts">
                <div><strong>{{ o.recordCount }}</strong><span>records</span></div>
                <div><strong>{{ o.activeCount }}</strong><span>active</span></div>
              </div>
            </div>
            <div class="school-card-body">
              <h3 class="school-card-name">{{ o.name }}</h3>
              <div class="org-meta-row">
                <code class="school-card-slug">{{ o.slug }}</code>
                <span class="industry-tag">{{ o.industry || 'education' }}</span>
              </div>
              <div class="school-card-actions">
                <button class="action-btn primary" @click="enterOrg(o.slug)">
                  <Icon name="switch" :size="14" /> Manage
                </button>
                <button class="action-btn ghost" @click="openEditOrg(o)" title="Edit">
                  <Icon name="pencil" :size="14" />
                </button>
                <button class="action-btn danger" @click="confirmDeleteOrg(o)" title="Delete">
                  <Icon name="trash" :size="14" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ── ORGANIZATION DETAIL ────────────────────────────────────────── -->
      <section v-else-if="tab === 'orgs' && activeOrg" class="tab-pane">
        <div class="school-header-card glass-card">
          <div class="sh-left" :style="{ background: `linear-gradient(135deg, ${activeOrg.org.themeColor || '#00b4d8'}, ${activeOrg.org.themeColor || '#00b4d8'}88)` }">
            <img v-if="activeOrg.org.logo" :src="activeOrg.org.logo" :alt="activeOrg.org.name" />
            <Icon v-else :name="getIndustryIcon(activeOrg.org.industry)" :size="28" />
          </div>
          <div class="sh-right">
            <div class="sh-meta-row">
              <code class="mono-chip">{{ activeOrg.org.slug }}</code>
              <span class="badge badge-active">{{ recordTotal }} records</span>
              <span class="industry-badge">{{ activeOrg.org.industry || 'education' }}</span>
            </div>
            <h2 class="sh-name">{{ activeOrg.org.name }}</h2>
            <div class="sh-actions">
              <button class="action-btn ghost" @click="openEditOrg(activeOrg.org)">
                <Icon name="pencil" :size="14" /> Edit organization
              </button>
              <a class="action-btn ghost" :href="`/${activeOrg.org.slug}`" target="_blank" rel="noopener">
                <Icon name="link" :size="14" /> Open public page
              </a>
              <button class="action-btn danger" @click="confirmDeleteOrg(activeOrg.org)">
                <Icon name="trash" :size="14" /> Delete organization
              </button>
            </div>
          </div>
        </div>

        <div class="toolbar">
          <div class="search-wrap">
            <Icon name="search" :size="16" />
            <input v-model="recordSearch" type="text" placeholder="Search records…" />
          </div>
          <select v-model="recordFilter" class="filter-select">
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="expired">Expired</option>
            <option value="revoked">Revoked</option>
          </select>
        </div>

        <div v-if="!filteredRecords.length" class="empty-state glass-card">
          <Icon name="users" :size="28" />
          <h3>No records match</h3>
          <p>Try a different search or filter.</p>
        </div>

        <div v-else class="students-list">
          <div v-for="rec in filteredRecords" :key="rec.recordId" class="student-row glass-card">
            <div class="sr-avatar" :style="{ background: avatarColor(rec.fullName) }">
              <img v-if="rec.photoUrl" :src="rec.photoUrl" :alt="rec.fullName" />
              <span v-else>{{ initials(rec.fullName) }}</span>
            </div>
            <div class="sr-info">
              <div class="sr-name-line">
                <span class="sr-name">{{ rec.fullName }}</span>
                <span class="badge" :class="`badge-${rec.status}`">{{ rec.status }}</span>
                <span class="entity-type-tag">{{ rec.entityType || 'student' }}</span>
              </div>
              <div class="sr-meta">
                <span class="sr-meta-item"><Icon name="hash" :size="12" />{{ rec.recordId }}</span>
                <span v-if="rec.category" class="sr-meta-item"><Icon name="list" :size="12" />{{ rec.category }}</span>
                <span v-if="rec.expiresAt" class="sr-meta-item"><Icon name="calendar" :size="12" />Expires {{ formatDate(rec.expiresAt) }}</span>
                <span class="sr-meta-item"><Icon name="scan" :size="12" />{{ rec.scanCount || 0 }} scans</span>
              </div>
            </div>
            <div class="sr-actions">
              <a class="icon-btn" :href="`/${activeOrg.org.slug}/${encodeURIComponent(rec.recordId)}`" target="_blank" rel="noopener" title="View ID">
                <Icon name="eye" :size="15" />
              </a>
              <button class="icon-btn" @click="openEditRecord(rec)" title="Edit">
                <Icon name="pencil" :size="15" />
              </button>
              <button
                class="icon-btn"
                :class="rec.status === 'revoked' ? 'success' : 'warn'"
                @click="toggleRevoke(rec)"
                :title="rec.status === 'revoked' ? 'Restore' : 'Revoke'"
              >
                <Icon :name="rec.status === 'revoked' ? 'check-circle' : 'x-circle'" :size="15" />
              </button>
              <button class="icon-btn danger" @click="confirmDeleteRecord(rec)" title="Delete">
                <Icon name="trash" :size="15" />
              </button>
            </div>
          </div>
        </div>

        <!-- Pagination bar -->
        <div v-if="recordTotalPages > 1" class="pagination-bar">
          <button class="pg-btn" :disabled="recordPage <= 1" @click="changePage(recordPage - 1)">
            <Icon name="arrow-left" :size="14" />
          </button>
          <div class="pg-pages">
            <button
              v-for="p in paginationRange"
              :key="p"
              class="pg-num"
              :class="{ active: p === recordPage, ellipsis: p === '…' }"
              :disabled="p === '…'"
              @click="p !== '…' && changePage(p)"
            >{{ p }}</button>
          </div>
          <button class="pg-btn" :disabled="recordPage >= recordTotalPages" @click="changePage(recordPage + 1)">
            <Icon name="arrow-right" :size="14" />
          </button>
          <span class="pg-info">
            {{ (recordPage - 1) * recordPageSize + 1 }}–{{ Math.min(recordPage * recordPageSize, recordTotal) }}
            of {{ recordTotal }}
          </span>
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

    <!-- ── Edit Organization modal ──────────────────────────────────────── -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="editOrg" class="modal-backdrop" @click.self="editOrg = null">
          <div class="modal-card form-modal">
            <div class="modal-head">
              <h3>Edit organization</h3>
              <button class="icon-btn" @click="editOrg = null"><Icon name="x" :size="16" /></button>
            </div>
            <label class="form-field">
              <span>Organization name</span>
              <input v-model="editOrg.name" type="text" />
            </label>
            <label class="form-field">
              <span>Industry</span>
              <select v-model="editOrg.industry">
                <option v-for="ind in industries" :key="ind" :value="ind">{{ ind }}</option>
              </select>
            </label>
            <label class="form-field">
              <span>Theme color</span>
              <div class="color-input-row">
                <input type="color" v-model="editOrg.themeColor" />
                <input type="text" v-model="editOrg.themeColor" placeholder="#00b4d8" />
              </div>
            </label>
            <div class="modal-actions">
              <button class="btn-ghost" @click="editOrg = null">Cancel</button>
              <button class="btn-primary" :disabled="saving" @click="saveEditOrg">
                <span v-if="saving" class="spinner-sm"></span>
                Save changes
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- ── Edit Record modal ────────────────────────────────────────────── -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="editRecord" class="modal-backdrop" @click.self="editRecord = null">
          <div class="modal-card form-modal">
            <div class="modal-head">
              <h3>Edit record</h3>
              <button class="icon-btn" @click="editRecord = null"><Icon name="x" :size="16" /></button>
            </div>
            <div class="modal-scroll">
              <label class="form-field">
                <span>Full name</span>
                <input v-model="editRecord.fullName" type="text" />
              </label>
              <label class="form-field">
                <span>Entity type</span>
                <input v-model="editRecord.entityType" type="text" placeholder="e.g. student, employee" />
              </label>
              <label class="form-field">
                <span>Category</span>
                <input v-model="editRecord.category" type="text" placeholder="e.g. class, department" />
              </label>
              <label class="form-field">
                <span>Expiry date</span>
                <input v-model="editRecord.expiresAt" type="date" />
              </label>
              <label class="form-field">
                <span>Status</span>
                <select v-model="editRecord.status">
                  <option value="active">Active</option>
                  <option value="expired">Expired</option>
                  <option value="revoked">Revoked</option>
                </select>
              </label>
            </div>
            <div class="modal-actions">
              <button class="btn-ghost" @click="editRecord = null">Cancel</button>
              <button class="btn-primary" :disabled="saving" @click="saveEditRecord">
                <span v-if="saving" class="spinner-sm"></span>
                Save changes
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- ── Delete Confirmation modal ────────────────────────────────────── -->
    <ConfirmModal
      v-if="confirmDelete"
      :title="confirmDelete.title"
      :message="confirmDelete.message"
      :confirmText="confirmDelete.confirmText"
      :danger="true"
      :loading="saving"
      @close="confirmDelete = null"
      @confirm="confirmDelete.action"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import Icon from '@/components/Icon.vue'
import ConfirmModal from '@/components/admin/ConfirmModal.vue'

// ── State ──────────────────────────────────────────────────────────────────
const tab = ref('overview')
const loading = ref(false)
const saving = ref(false)
const adminUser = ref(localStorage.getItem('ic_admin_user') || 'Admin')

const overview = ref(null)
const orgs = ref([])
const activeOrg = ref(null)
const logs = ref([])

const orgSearch = ref('')
const recordSearch = ref('')
const recordFilter = ref('')
const recordPage = ref(1)
const recordPageSize = ref(50)
const recordTotal = ref(0)
const recordTotalPages = ref(1)

const editOrg = ref(null)
const editRecord = ref(null)
const confirmDelete = ref(null)

const navItems = [
  { key: 'overview', label: 'Overview', icon: 'activity' },
  { key: 'orgs', label: 'Organizations', icon: 'company' },
  { key: 'logs', label: 'System Logs', icon: 'list' },
]

const industries = [
  'school', 'hospital', 'company', 'church', 'ngo', 'university', 'event', 'transport', 'gym', 'hotel', 'government', 'custom'
]

// ── Computed ───────────────────────────────────────────────────────────────
const pageTitle = computed(() => {
  if (tab.value === 'overview') return 'Dashboard Overview'
  if (tab.value === 'orgs') return activeOrg.value ? activeOrg.value.org.name : 'Organizations'
  if (tab.value === 'logs') return 'System Activity Logs'
  return 'Admin Console'
})

const pageSub = computed(() => {
  if (tab.value === 'overview') return 'Real-time metrics and recent activity across the platform.'
  if (tab.value === 'orgs') return activeOrg.value ? `Manage records for ${activeOrg.value.org.slug}` : 'Manage all organizations and their identity records.'
  if (tab.value === 'logs') return 'Detailed audit trail of all system events and QR scans.'
  return ''
})

const kpis = computed(() => [
  { label: 'Total Orgs', value: overview.value?.totals?.orgs || 0, icon: 'company', color: '#00b4d8' },
  { label: 'Total Records', value: overview.value?.totals?.records || 0, icon: 'users', color: '#7b61ff' },
  { label: 'Active IDs', value: overview.value?.totals?.active || 0, icon: 'check-circle', color: '#06d6a0' },
  { label: 'Total Scans', value: overview.value?.totals?.totalScans || 0, icon: 'scan', color: '#ff9500' },
])

const filteredOrgs = computed(() => {
  if (!orgSearch.value) return orgs.value
  const s = orgSearch.value.toLowerCase()
  return orgs.value.filter(o => o.name.toLowerCase().includes(s) || o.slug.toLowerCase().includes(s))
})

const filteredRecords = computed(() => activeOrg.value?.records || [])

const paginationRange = computed(() => {
  const current = recordPage.value
  const total = recordTotalPages.value
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const range = []
  if (current > 3) range.push(1, '…')
  for (let i = Math.max(1, current - 2); i <= Math.min(total, current + 2); i++) {
    if (!range.includes(i)) range.push(i)
  }
  if (current < total - 2) range.push('…', total)
  return range
})

// ── Methods ────────────────────────────────────────────────────────────────
const goTab = (k) => {
  tab.value = k
  if (k === 'orgs') activeOrg.value = null
  refresh()
}

const refresh = async () => {
  loading.value = true
  try {
    if (tab.value === 'overview') {
      const { data } = await axios.get('/api/admin/overview')
      overview.value = data
    } else if (tab.value === 'orgs') {
      if (activeOrg.value) {
        await fetchOrgDetail(activeOrg.value.org.slug)
      } else {
        const { data } = await axios.get('/api/admin/orgs')
        orgs.value = data
      }
    } else if (tab.value === 'logs') {
      const { data } = await axios.get('/api/admin/overview')
      logs.value = data.recentActivity || []
    }
  } catch (e) {
    console.error('Refresh failed', e)
  } finally {
    loading.value = false
  }
}

const fetchOrgDetail = async (slug) => {
  try {
    const { data } = await axios.get(`/api/admin/orgs/${slug}`, {
      params: {
        page: recordPage.value,
        limit: recordPageSize.value,
        search: recordSearch.value,
        status: recordFilter.value
      }
    })
    activeOrg.value = {
      org: data.org,
      records: data.records
    }
    recordTotal.value = data.pagination.total
    recordTotalPages.value = data.pagination.pages
  } catch (e) {
    console.error('Fetch org detail failed', e)
  }
}

const enterOrg = (slug) => {
  recordPage.value = 1
  recordSearch.value = ''
  recordFilter.value = ''
  fetchOrgDetail(slug)
}

const exitOrg = () => {
  activeOrg.value = null
  refresh()
}

const changePage = (p) => {
  recordPage.value = p
  fetchOrgDetail(activeOrg.value.org.slug)
}

const openEditOrg = (o) => {
  editOrg.value = { ...o }
}

const saveEditOrg = async () => {
  saving.value = true
  try {
    await axios.patch(`/api/admin/orgs/${editOrg.value.slug}`, editOrg.value)
    editOrg.value = null
    refresh()
  } catch (e) {
    alert('Failed to save changes')
  } finally {
    saving.value = false
  }
}

const confirmDeleteOrg = (o) => {
  confirmDelete.value = {
    title: 'Delete Organization?',
    message: `This will permanently delete "${o.name}" and ALL its records. This action cannot be undone.`,
    confirmText: 'Delete Everything',
    action: async () => {
      saving.value = true
      try {
        await axios.delete(`/api/admin/orgs/${o.slug}`)
        confirmDelete.value = null
        activeOrg.value = null
        refresh()
      } catch (e) {
        alert('Delete failed')
      } finally {
        saving.value = false
      }
    }
  }
}

const openEditRecord = (r) => {
  editRecord.value = { ...r }
  if (editRecord.value.expiresAt) {
    editRecord.value.expiresAt = editRecord.value.expiresAt.split('T')[0]
  }
}

const saveEditRecord = async () => {
  saving.value = true
  try {
    const slug = activeOrg.value.org.slug
    await axios.patch(`/api/admin/orgs/${slug}/records/${encodeURIComponent(editRecord.value.recordId)}`, editRecord.value)
    editRecord.value = null
    fetchOrgDetail(slug)
  } catch (e) {
    alert('Failed to save changes')
  } finally {
    saving.value = false
  }
}

const toggleRevoke = async (r) => {
  const newStatus = r.status === 'revoked' ? 'active' : 'revoked'
  try {
    const slug = activeOrg.value.org.slug
    await axios.patch(`/api/admin/orgs/${slug}/records/${encodeURIComponent(r.recordId)}`, { status: newStatus })
    fetchOrgDetail(slug)
  } catch (e) {
    alert('Action failed')
  }
}

const confirmDeleteRecord = (r) => {
  confirmDelete.value = {
    title: 'Delete Record?',
    message: `Are you sure you want to delete ${r.fullName}? This identity will no longer be verifiable.`,
    confirmText: 'Delete Record',
    action: async () => {
      saving.value = true
      try {
        const slug = activeOrg.value.org.slug
        await axios.delete(`/api/admin/orgs/${slug}/records/${encodeURIComponent(r.recordId)}`)
        confirmDelete.value = null
        fetchOrgDetail(slug)
      } catch (e) {
        alert('Delete failed')
      } finally {
        saving.value = false
      }
    }
  }
}

const logout = () => {
  localStorage.removeItem('ic_admin_token')
  localStorage.removeItem('ic_admin_user')
  window.location.reload()
}

const formatTime = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' · ' + d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

const formatDate = (iso) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const initials = (name) => {
  return (name || '').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

const avatarColor = (name) => {
  const colors = ['#00b4d8', '#7b61ff', '#06d6a0', '#ff9500', '#ef476f', '#118ab2']
  let hash = 0
  for (let i = 0; i < (name || '').length; i++) hash = (name.charCodeAt(i) + ((hash << 5) - hash))
  return colors[Math.abs(hash) % colors.length]
}

const getIndustryIcon = (ind) => {
  const icons = {
    school: 'school',
    hospital: 'hospital',
    company: 'company',
    church: 'church',
    ngo: 'ngo',
    university: 'school',
    event: 'event',
    transport: 'transport',
    gym: 'activity',
    hotel: 'company',
    government: 'shield-check',
    custom: 'id-card'
  }
  return icons[ind] || 'company'
}

// ── Watchers ───────────────────────────────────────────────────────────────
watch([recordSearch, recordFilter], () => {
  if (activeOrg.value) {
    recordPage.value = 1
    fetchOrgDetail(activeOrg.value.org.slug)
  }
})

onMounted(refresh)
</script>

<style scoped>
.admin-shell {
  display: flex;
  min-height: 100vh;
  background: #f8fafc;
  color: #1e293b;
}

/* ── Sidebar ──────────────────────────────────────────────────────────────── */
.sidebar {
  width: 260px;
  background: #fff;
  border-right: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  padding: 24px 16px;
  position: sticky;
  top: 0;
  height: 100vh;
  z-index: 10;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 32px;
  padding: 0 8px;
}

.brand-icon {
  width: 36px;
  height: 36px;
  background: #7b61ff;
  color: #fff;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.brand-title {
  font-weight: 700;
  font-size: 1.1rem;
  letter-spacing: -0.02em;
}

.brand-sub {
  font-size: 0.75rem;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 600;
}

.nav {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: #64748b;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
}

.nav-item:hover {
  background: #f1f5f9;
  color: #1e293b;
}

.nav-item.active {
  background: #7b61ff15;
  color: #7b61ff;
}

.sidebar-footer {
  margin-top: auto;
  padding-top: 16px;
  border-top: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.user-chip {
  display: flex;
  align-items: center;
  gap: 10px;
}

.user-avatar {
  width: 32px;
  height: 32px;
  background: #e2e8f0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #64748b;
}

.user-name {
  font-size: 0.85rem;
  font-weight: 700;
}

.user-role {
  font-size: 0.7rem;
  color: #64748b;
}

.logout-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.logout-btn:hover {
  background: #fee2e2;
  color: #ef4444;
}

/* ── Content ──────────────────────────────────────────────────────────────── */
.content {
  flex: 1;
  padding: 32px 40px;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}

.content-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 32px;
}

.crumbs {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 0.85rem;
}

.crumb-btn {
  background: transparent;
  border: none;
  color: #64748b;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
}

.crumb-btn:hover {
  color: #7b61ff;
}

.crumb-sep {
  color: #cbd5e1;
}

.crumb-current {
  color: #1e293b;
  font-weight: 700;
}

.page-title {
  font-size: 1.8rem;
  font-weight: 800;
  letter-spacing: -0.03em;
  margin-bottom: 4px;
}

.page-sub {
  color: #64748b;
  font-size: 0.95rem;
}

.refresh-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
}

.refresh-btn:hover:not(:disabled) {
  background: #f8fafc;
  border-color: #cbd5e1;
}

.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* ── KPI Grid ─────────────────────────────────────────────────────────────── */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  margin-bottom: 32px;
}

.kpi-card {
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  background: #fff;
  border-radius: 16px;
  border: 1px solid #e2e8f0;
}

.kpi-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--kc), transparent 85%);
  color: var(--kc);
  display: flex;
  align-items: center;
  justify-content: center;
}

.kpi-num {
  font-size: 1.5rem;
  font-weight: 800;
  line-height: 1;
  margin-bottom: 4px;
}

.kpi-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

/* ── Panel ────────────────────────────────────────────────────────────────── */
.panel {
  background: #fff;
  border-radius: 16px;
  border: 1px solid #e2e8f0;
  overflow: hidden;
}

.panel-header {
  padding: 16px 20px;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 700;
  font-size: 0.95rem;
}

.activity-list {
  display: flex;
  flex-direction: column;
}

.activity-row {
  display: flex;
  gap: 16px;
  padding: 16px 20px;
  border-bottom: 1px solid #f1f5f9;
}

.activity-row:last-child {
  border-bottom: none;
}

.activity-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-top: 6px;
  flex-shrink: 0;
}

.dot-login { background: #06d6a0; }
.dot-publish { background: #7b61ff; }
.dot-scan { background: #ff9500; }
.dot-update { background: #00b4d8; }
.dot-delete { background: #ef4444; }

.activity-body {
  flex: 1;
}

.activity-msg {
  font-size: 0.9rem;
  font-weight: 500;
  margin-bottom: 6px;
}

.activity-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tag {
  font-size: 0.65rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
  background: #f1f5f9;
  color: #475569;
  text-transform: uppercase;
}

.tag-soft {
  background: transparent;
  border: 1px solid #e2e8f0;
}

.time {
  font-size: 0.75rem;
  color: #94a3b8;
  margin-left: auto;
}

.empty-row {
  padding: 40px;
  text-align: center;
  color: #94a3b8;
  font-size: 0.9rem;
}

/* ── Toolbar ──────────────────────────────────────────────────────────────── */
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  gap: 16px;
}

.search-wrap {
  flex: 1;
  max-width: 400px;
  position: relative;
  display: flex;
  align-items: center;
}

.search-wrap i, .search-wrap svg {
  position: absolute;
  left: 12px;
  color: #94a3b8;
}

.search-wrap input {
  width: 100%;
  padding: 10px 12px 10px 40px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  font-size: 0.9rem;
  outline: none;
  transition: all 0.2s;
}

.search-wrap input:focus {
  border-color: #7b61ff;
  box-shadow: 0 0 0 3px #7b61ff15;
}

.filter-select {
  padding: 10px 16px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  font-size: 0.9rem;
  font-weight: 600;
  outline: none;
  cursor: pointer;
}

.count-chip {
  font-size: 0.85rem;
  font-weight: 700;
  color: #64748b;
  background: #f1f5f9;
  padding: 6px 12px;
  border-radius: 20px;
}

/* ── Grid/List ────────────────────────────────────────────────────────────── */
.schools-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 24px;
}

.school-card {
  background: #fff;
  border-radius: 20px;
  border: 1px solid #e2e8f0;
  overflow: hidden;
  transition: all 0.3s;
}

.school-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px -8px rgba(0,0,0,0.1);
}

.school-card-top {
  height: 80px;
  padding: 16px 20px;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  position: relative;
}

.school-logo-mini {
  width: 56px;
  height: 56px;
  background: #fff;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
  overflow: hidden;
  margin-bottom: -28px;
}

.school-logo-mini img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.school-counts {
  display: flex;
  gap: 16px;
  color: #fff;
  text-align: right;
}

.school-counts strong {
  display: block;
  font-size: 1.1rem;
  line-height: 1;
}

.school-counts span {
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  opacity: 0.9;
}

.school-card-body {
  padding: 36px 20px 20px;
}

.school-card-name {
  font-size: 1.15rem;
  font-weight: 800;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.org-meta-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.school-card-slug {
  font-size: 0.75rem;
  color: #94a3b8;
  font-family: var(--font-mono);
}

.industry-tag {
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  padding: 2px 8px;
  background: #f1f5f9;
  border-radius: 4px;
  color: #64748b;
}

.school-card-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px;
  border-radius: 8px;
  font-weight: 700;
  font-size: 0.8rem;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.2s;
}

.action-btn.primary {
  background: #7b61ff;
  color: #fff;
}

.action-btn.ghost {
  background: #f1f5f9;
  color: #475569;
}

.action-btn.danger {
  background: transparent;
  color: #ef4444;
  border-color: #fee2e2;
  flex: 0 0 40px;
}

.action-btn.danger:hover {
  background: #ef4444;
  color: #fff;
}

/* ── School Detail ────────────────────────────────────────────────────────── */
.school-header-card {
  display: flex;
  gap: 32px;
  padding: 24px;
  background: #fff;
  border-radius: 24px;
  border: 1px solid #e2e8f0;
  margin-bottom: 32px;
}

.sh-left {
  width: 120px;
  height: 120px;
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  overflow: hidden;
  flex-shrink: 0;
}

.sh-left img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #fff;
}

.sh-right {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.sh-meta-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.mono-chip {
  font-family: var(--font-mono);
  font-size: 0.8rem;
  background: #f1f5f9;
  padding: 4px 10px;
  border-radius: 6px;
  color: #64748b;
}

.badge {
  font-size: 0.75rem;
  font-weight: 700;
  padding: 4px 12px;
  border-radius: 20px;
}

.badge-active { background: #06d6a015; color: #06d6a0; }
.badge-expired { background: #ef444415; color: #ef4444; }
.badge-revoked { background: #ff950015; color: #ff9500; }

.industry-badge {
  font-size: 0.7rem;
  font-weight: 800;
  text-transform: uppercase;
  color: #94a3b8;
  letter-spacing: 0.05em;
}

.sh-name {
  font-size: 2rem;
  font-weight: 800;
  letter-spacing: -0.04em;
  margin-bottom: 16px;
}

.sh-actions {
  display: flex;
  gap: 12px;
}

.students-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.student-row {
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 20px;
  background: #fff;
  border-radius: 16px;
  border: 1px solid #e2e8f0;
  transition: all 0.2s;
}

.student-row:hover {
  border-color: #7b61ff;
  box-shadow: 0 4px 12px rgba(123,97,255,0.05);
}

.sr-avatar {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 700;
  font-size: 1.2rem;
  overflow: hidden;
  flex-shrink: 0;
}

.sr-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.sr-info {
  flex: 1;
}

.sr-name-line {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 4px;
}

.sr-name {
  font-weight: 700;
  font-size: 1rem;
}

.entity-type-tag {
  font-size: 0.65rem;
  font-weight: 700;
  color: #94a3b8;
  text-transform: uppercase;
  background: #f8fafc;
  padding: 2px 6px;
  border-radius: 4px;
}

.sr-meta {
  display: flex;
  align-items: center;
  gap: 16px;
}

.sr-meta-item {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.8rem;
  color: #64748b;
  font-weight: 500;
}

.sr-actions {
  display: flex;
  gap: 8px;
}

.icon-btn {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: none;
  background: #f1f5f9;
  color: #64748b;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  text-decoration: none;
}

.icon-btn:hover {
  background: #e2e8f0;
  color: #1e293b;
}

.icon-btn.success:hover { background: #dcfce7; color: #059669; }
.icon-btn.warn:hover { background: #fef3c7; color: #d97706; }
.icon-btn.danger:hover { background: #fee2e2; color: #dc2626; }

/* ── Pagination ───────────────────────────────────────────────────────────── */
.pagination-bar {
  margin-top: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
}

.pg-pages {
  display: flex;
  gap: 6px;
}

.pg-num {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  background: #fff;
  font-weight: 700;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
}

.pg-num:hover:not(:disabled) {
  border-color: #7b61ff;
  color: #7b61ff;
}

.pg-num.active {
  background: #7b61ff;
  color: #fff;
  border-color: #7b61ff;
}

.pg-num.ellipsis {
  border: none;
  background: transparent;
  cursor: default;
}

.pg-btn {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.pg-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pg-info {
  font-size: 0.85rem;
  color: #64748b;
  font-weight: 600;
}

/* ── Modals ───────────────────────────────────────────────────────────────── */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal-card {
  background: #fff;
  border-radius: 24px;
  width: 100%;
  max-width: 480px;
  box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
  display: flex;
  flex-direction: column;
}

.modal-head {
  padding: 24px 24px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.modal-head h3 {
  font-size: 1.25rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.modal-scroll {
  padding: 0 24px;
  max-height: 60vh;
  overflow-y: auto;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 20px;
}

.form-field span {
  font-size: 0.85rem;
  font-weight: 700;
  color: #64748b;
}

.form-field input, .form-field select {
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  font-size: 0.95rem;
  outline: none;
}

.form-field input:focus {
  border-color: #7b61ff;
}

.color-input-row {
  display: flex;
  gap: 12px;
}

.color-input-row input[type="color"] {
  width: 48px;
  padding: 2px;
  height: 48px;
}

.color-input-row input[type="text"] {
  flex: 1;
}

.modal-actions {
  padding: 24px;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  border-top: 1px solid #f1f5f9;
}

.btn-primary {
  padding: 10px 24px;
  background: #7b61ff;
  color: #fff;
  border: none;
  border-radius: 10px;
  font-weight: 700;
  cursor: pointer;
}

.btn-ghost {
  padding: 10px 24px;
  background: #f1f5f9;
  color: #475569;
  border: none;
  border-radius: 10px;
  font-weight: 700;
  cursor: pointer;
}

.spinner-sm {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  display: inline-block;
  margin-right: 8px;
}

/* ── Transitions ──────────────────────────────────────────────────────────── */
.modal-enter-active, .modal-leave-active { transition: opacity 0.3s; }
.modal-enter-from, .modal-leave-to { opacity: 0; }

.page-enter-active, .page-leave-active { transition: all 0.3s; }
.page-enter-from { opacity: 0; transform: translateY(10px); }
.page-leave-to { opacity: 0; transform: translateY(-10px); }

@media (max-width: 768px) {
  .sidebar {
    display: none;
  }
  .content {
    padding: 20px;
  }
  .kpi-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
