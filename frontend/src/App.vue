<template>
  <div class="app-root">
    <!-- Floating nav bar (hidden on /admin/* — dashboard has its own chrome) -->
    <nav v-if="!isAdminRoute" class="top-nav glass-card">
      <div class="nav-inner">
        <a href="/" class="nav-brand">
          <span class="brand-mark"><img src="/favicon.svg" alt="icon" width="30" height="30" /></span>
          <span class="brand-text">Identity Cloud</span>
        </a>
        <span class="nav-badge">
          <Icon name="qr-code" :size="11" />
          Verification System
        </span>
      </div>
    </nav>

    <!-- Lightweight header for admin routes -->
    <nav v-else class="top-nav glass-card admin-nav">
      <div class="nav-inner">
        <a href="/" class="nav-brand">
          <span class="brand-mark"><Icon name="shield-check" :size="18" /></span>
          <span class="brand-text">Identity Cloud</span>
        </a>
        <span class="nav-badge admin">
          <Icon name="settings" :size="11" />
          Admin
        </span>
      </div>
    </nav>

    <!-- Main content -->
    <main class="main-content" :class="{ 'admin-content': isAdminRoute }">
      <RouterView v-slot="{ Component }">
        <Transition name="page" mode="out-in">
          <component :is="Component" />
        </Transition>
      </RouterView>
    </main>

    <!-- Footer (hidden on dashboard for full-bleed feel) -->
    <footer v-if="!isAdminRoute" class="site-footer">
      <Icon name="shield-check" :size="12" />
      <span>Powered by <strong>Identity Cloud</strong> &amp; Card Studio</span>
      <span class="footer-dot">·</span>
      <span>Secure · Real-time · QR-Verified</span>
    </footer>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import Icon from '@/components/Icon.vue'

const route = useRoute()
const isAdminRoute = computed(() => (route.path || '').startsWith('/admin'))
</script>

<style scoped>
.app-root {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  position: relative;
  z-index: 1;
}

/* ── Nav ──────────────────────────────────────────────────────────────────── */
.top-nav {
  position: sticky;
  top: 16px;
  z-index: 100;
  margin: 16px 20px 0;
  border-radius: 18px;
  padding: 0;
}
.nav-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 11px 18px;
  gap: 10px;
}
.nav-brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  font-weight: 700;
  font-size: 1rem;
  color: var(--text-primary);
  letter-spacing: -0.02em;
}
.nav-brand:hover { text-decoration: none; opacity: 0.85; }
.brand-mark {
  width: 32px; height: 32px;
  border-radius: 10px;
  display: inline-flex; align-items: center; justify-content: center;
}
.nav-badge {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: var(--accent-2);
  background: rgba(0,180,216,0.1);
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid rgba(0,180,216,0.2);
}
.nav-badge.admin {
  color: #7b61ff;
  background: rgba(123,97,255,0.1);
  border-color: rgba(123,97,255,0.22);
}

/* ── Content ──────────────────────────────────────────────────────────────── */
.main-content {
  flex: 1;
  padding: 28px 22px;
  max-width: 880px;
  width: 100%;
  margin: 0 auto;
}
.main-content.admin-content {
  max-width: none;
  padding: 24px 0;
}

/* ── Footer ───────────────────────────────────────────────────────────────── */
.site-footer {
  text-align: center;
  padding: 22px 16px;
  font-size: 0.78rem;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex-wrap: wrap;
}
.footer-dot { opacity: 0.4; }

/* ── Page transition ──────────────────────────────────────────────────────── */
.page-enter-active,
.page-leave-active { transition: opacity 0.25s ease, transform 0.25s ease; }
.page-enter-from { opacity: 0; transform: translateY(10px); }
.page-leave-to  { opacity: 0; transform: translateY(-6px); }

@media (max-width: 480px) {
  .top-nav { margin: 12px 14px 0; }
  .nav-inner { padding: 10px 14px; }
  .brand-text { font-size: 0.95rem; }
  .main-content { padding: 22px 14px; }
}
</style>
