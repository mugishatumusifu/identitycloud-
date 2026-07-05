<template>
  <div class="school-page">
    <div v-if="loading" class="loading-center">
      <div class="spinner"></div>
    </div>

    <div v-else-if="!school" class="error-box glass-card fade-up">
      <div class="err-icon"><Icon name="building" :size="32" /></div>
      <h2>Industry Not Found</h2>
      <p>No industry with slug <code>{{ schoolSlug }}</code> has been published.</p>
      <a href="/" class="back-btn"><Icon name="arrow-left" :size="14" /> Home</a>
    </div>

    <div v-else class="school-content">
      <!-- Header -->
      <div class="school-header glass-card fade-up" :style="{ borderTop: `4px solid ${school.themeColor || '#00b4d8'}` }">
        <div class="school-logo" v-if="school.logo">
          <img :src="school.logo" :alt="school.name" />
        </div>
        <div class="school-logo-placeholder" v-else :style="{ background: `linear-gradient(135deg, ${school.themeColor || '#00b4d8'}, ${school.themeColor || '#0077b6'})` }">
          <Icon :name="orgIcon" :size="26" />
        </div>
        <div class="school-info">
          <h1 class="school-name">{{ school.name }}</h1>
          <div class="school-meta">
            <span class="mono-chip"><Icon name="hash" :size="11" />{{ school.slug }}</span>
            <span class="count-chip">
              <Icon name="users" :size="12" />
              {{ school.studentCount }} {{ (school.studentCount !== 1 ? entityLabelPlural : entityLabel).toLowerCase() }}
            </span>
          </div>
        </div>
      </div>

      <!-- Students -->
      <div class="students-section fade-up fade-up-2" v-if="students.length">
        <div class="section-title">
          <Icon name="id-card" :size="13" />
          <span>Published {{ entityLabelPlural }}</span>
        </div>
        <div class="students-grid">
          <a
            v-for="s in students"
            :key="s.studentId"
            :href="`/${schoolSlug}/${encodeURIComponent(s.studentId)}`"
            class="student-card glass-card"
          >
            <div class="card-avatar" :style="{ background: avatarColor(s.fullName) }">
              <img v-if="s.photoUrl" :src="s.photoUrl" :alt="s.fullName" />
              <span v-else>{{ initials(s.fullName) }}</span>
            </div>
            <div class="card-body">
              <div class="card-name">{{ s.fullName }}</div>
              <div class="card-id">
                <Icon name="hash" :size="11" />
                {{ s.studentId }}
              </div>
              <div v-if="s.class" class="card-class">
                <Icon name="graduate" :size="11" />
                {{ s.class }}
              </div>
            </div>
            <div class="card-foot">
              <span class="badge" :class="`badge-${s.status}`">
                <span class="badge-dot"></span>
                {{ s.status }}
              </span>
              <Icon name="chevron-right" :size="14" class="chev" />
            </div>
          </a>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'
import Icon from '@/components/Icon.vue'

const props = defineProps({ schoolSlug: String })

const loading  = ref(true)
const school   = ref(null)
const students = ref([])

function initials(name) {
  return (name || '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

const COLORS = ['#00b4d8','#0077b6','#06d6a0','#118ab2','#7b61ff','#ff9500']
function avatarColor(name) {
  const i = (name || 'A').charCodeAt(0) % COLORS.length
  return `linear-gradient(135deg, ${COLORS[i]}, ${COLORS[(i + 2) % COLORS.length]})`
}

// ── Universal industry support ────────────────────────────────────────────────
const entityLabel = computed(() => school.value?.entityLabel || 'Student')
const entityLabelPlural = computed(() => school.value?.entityLabelPlural || 'Students')

const INDUSTRY_ICONS = {
  school: 'school', university: 'school', hospital: 'shield-check',
  company: 'building', hotel: 'building', government: 'building',
  church: 'users', ngo: 'users', gym: 'users', event: 'sparkles',
  transport: 'link', custom: 'id-card',
}
const orgIcon = computed(() => INDUSTRY_ICONS[school.value?.industry] || 'school')

onMounted(async () => {
  try {
    const [schoolRes, studentsRes] = await Promise.all([
      axios.get(`/api/school/${props.schoolSlug}`),
      axios.get(`/api/school/${props.schoolSlug}/students`),
    ])
    if (schoolRes.data && typeof schoolRes.data === 'object' && schoolRes.data.name) {
      school.value = schoolRes.data
    }
    students.value = Array.isArray(studentsRes.data) ? studentsRes.data : []
  } catch (_) {} finally {
    loading.value = false
  }
})
</script>

<style scoped>
.school-page { min-height: 60vh; }
.loading-center { display: flex; justify-content: center; padding: 80px 0; }

.error-box {
  padding: 48px 28px;
  text-align: center;
  display: flex; flex-direction: column; align-items: center; gap: 12px;
  max-width: 420px; margin: 60px auto;
}
.err-icon {
  width: 64px; height: 64px;
  border-radius: 18px;
  background: rgba(0,180,216,0.12);
  color: var(--accent-2);
  display: flex; align-items: center; justify-content: center;
}
.error-box h2 { font-size: 1.4rem; }
.error-box p  { color: var(--text-secondary); font-size: 0.9rem; }
.error-box code {
  font-family: var(--font-mono);
  background: rgba(0,0,0,0.06);
  padding: 2px 6px; border-radius: 6px;
}
.back-btn {
  margin-top: 8px;
  display: inline-flex; align-items: center; gap: 6px;
  padding: 10px 22px;
  background: var(--accent); color: #fff;
  border-radius: 10px; font-weight: 600;
  text-decoration: none;
}
.back-btn:hover { text-decoration: none; background: var(--accent-2); }

/* ── School header ─────────────────────────────────────────────────────────── */
.school-content { display: flex; flex-direction: column; gap: 22px; }
.school-header {
  display: flex; align-items: center; gap: 18px;
  padding: 22px 24px;
  border-radius: 22px;
}
.school-logo, .school-logo-placeholder {
  width: 56px; height: 56px;
  border-radius: 14px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
}
.school-logo img { width: 100%; height: 100%; object-fit: cover; }
.school-logo-placeholder { color: #fff; }
.school-info { flex: 1; min-width: 0; }
.school-name {
  font-size: 1.5rem; font-weight: 700; color: var(--text-primary);
  letter-spacing: -0.02em;
}
.school-meta { display: flex; align-items: center; gap: 10px; margin-top: 8px; flex-wrap: wrap; }
.mono-chip {
  display: inline-flex; align-items: center; gap: 4px;
  font-family: var(--font-mono); font-size: 0.72rem;
  background: rgba(0,180,216,0.1);
  color: var(--accent-2);
  padding: 3px 10px; border-radius: 6px;
  border: 1px solid rgba(0,180,216,0.18);
}
.count-chip {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 0.78rem; color: var(--text-muted);
  background: rgba(0,0,0,0.04);
  padding: 3px 10px; border-radius: 999px;
}

/* ── Students grid ─────────────────────────────────────────────────────────── */
.section-title {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-muted);
  margin-bottom: 10px;
}
.students-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
}
.student-card {
  padding: 16px;
  display: flex; align-items: center; gap: 14px;
  text-decoration: none; color: inherit;
  border-radius: 18px;
  transition: transform var(--transition), box-shadow var(--ease);
  position: relative;
}
.student-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 14px 32px rgba(0,60,100,0.12);
  text-decoration: none;
}
.card-avatar {
  width: 48px; height: 48px;
  border-radius: 14px;
  color: #fff; font-weight: 700; font-size: 0.9rem;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; overflow: hidden;
}
.card-avatar img { width: 100%; height: 100%; object-fit: cover; }
.card-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.card-name { font-weight: 700; font-size: 0.95rem; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.card-id, .card-class {
  display: inline-flex; align-items: center; gap: 4px;
  font-family: var(--font-mono); font-size: 0.72rem; color: var(--text-muted);
}
.card-class { font-family: var(--font-body); }
.card-foot { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0; }
.chev { color: var(--text-muted); }
.student-card:hover .chev { color: var(--accent); transform: translateX(2px); transition: 0.15s; }

@media (max-width: 480px) {
  .school-header { padding: 18px; }
  .school-name { font-size: 1.25rem; }
  .students-grid { grid-template-columns: 1fr; }
}
</style>
