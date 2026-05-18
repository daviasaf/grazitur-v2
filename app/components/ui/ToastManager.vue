<template>
  <div class="toast-container position-fixed bottom-0 end-0 p-3" style="z-index: 9999">
    <div v-for="t in toasts" :key="t.id" class="toast show border-0 mb-2 rounded-gt shadow-soft" :class="toastClass(t.type)">
      <div class="d-flex align-items-center justify-content-between gap-3 w-100">
        <div class="toast-body fw-semibold flex-grow-1 pe-2">{{ t.message }}</div>
        <button type="button" class="btn-close toast-close-right ms-auto me-2" :class="t.type === 'warning' ? '' : 'btn-close-white'" @click="removerToast(t.id)"></button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { toasts, removerToast } = useToasts()
const toastClass = (type: string) => {
  if (type === 'danger') return 'text-bg-danger'
  if (type === 'warning') return 'text-bg-warning'
  if (type === 'info') return 'text-bg-primary'
  return 'text-bg-success'
}
</script>
