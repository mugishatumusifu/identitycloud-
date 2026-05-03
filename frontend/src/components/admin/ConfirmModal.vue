<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="modal-backdrop" @click.self="$emit('cancel')">
        <div class="modal-card" role="dialog" aria-modal="true">
          <div class="modal-icon" :class="`icon-${tone}`">
            <Icon :name="tone === 'danger' ? 'alert-triangle' : 'info'" :size="22" />
          </div>
          <h3 class="modal-title">{{ title }}</h3>
          <p class="modal-msg">{{ message }}</p>
          <div class="modal-actions">
            <button class="btn-ghost" @click="$emit('cancel')">{{ cancelLabel }}</button>
            <button
              class="btn-primary"
              :class="{ 'btn-danger': tone === 'danger' }"
              :disabled="loading"
              @click="$emit('confirm')"
            >
              <span v-if="loading" class="spinner-sm"></span>
              {{ loading ? 'Working…' : confirmLabel }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import Icon from '@/components/Icon.vue'

defineProps({
  open: Boolean,
  title: { type: String, default: 'Are you sure?' },
  message: { type: String, default: '' },
  confirmLabel: { type: String, default: 'Confirm' },
  cancelLabel: { type: String, default: 'Cancel' },
  tone: { type: String, default: 'danger' }, // danger | info
  loading: Boolean,
})
defineEmits(['confirm', 'cancel'])
</script>

<style scoped>
.modal-backdrop {
  position: fixed; inset: 0;
  background: rgba(10, 25, 45, 0.55);
  backdrop-filter: blur(6px);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000;
  padding: 16px;
}
.modal-card {
  background: #fff;
  border-radius: 18px;
  padding: 28px 26px 22px;
  max-width: 420px;
  width: 100%;
  box-shadow: 0 30px 80px -20px rgba(0,40,80,0.4);
  display: flex; flex-direction: column; align-items: center; gap: 10px;
  text-align: center;
}
.modal-icon {
  width: 48px; height: 48px;
  border-radius: 14px;
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 4px;
}
.icon-danger { background: rgba(239,71,111,0.12); color: #ef476f; }
.icon-info   { background: rgba(0,180,216,0.12); color: #00b4d8; }
.modal-title { font-size: 1.15rem; font-weight: 700; color: #0a192f; }
.modal-msg   { font-size: 0.92rem; color: #506680; line-height: 1.5; }
.modal-actions {
  display: flex; gap: 10px; margin-top: 14px; width: 100%;
}
.btn-ghost, .btn-primary {
  flex: 1;
  padding: 11px 16px;
  border-radius: 11px;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  border: 1px solid transparent;
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  transition: transform 0.15s, background 0.2s;
}
.btn-ghost {
  background: #f0f4f8;
  color: #506680;
}
.btn-ghost:hover { background: #e3eaf2; }
.btn-primary {
  background: #00b4d8;
  color: #fff;
}
.btn-primary:hover:not(:disabled) { background: #0096b8; transform: scale(1.02); }
.btn-primary.btn-danger { background: #ef476f; }
.btn-primary.btn-danger:hover:not(:disabled) { background: #d63862; }
.btn-primary:disabled { opacity: 0.6; cursor: default; }
.spinner-sm {
  width: 14px; height: 14px;
  border: 2px solid rgba(255,255,255,0.4);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.modal-enter-active, .modal-leave-active { transition: opacity 0.2s; }
.modal-enter-active .modal-card, .modal-leave-active .modal-card { transition: transform 0.2s; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-from .modal-card { transform: scale(0.94); }
.modal-leave-to .modal-card   { transform: scale(0.96); }
</style>
