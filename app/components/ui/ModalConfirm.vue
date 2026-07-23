<template>
  <div class="modal fade show d-block gt-modal-backdrop" style="z-index: 1095">
    <div class="modal-dialog modal-dialog-centered px-3" style="max-width: 420px">
      <div class="modal-content border-0 rounded-gt shadow-soft">
        <div class="modal-body p-4 text-center">
          <span class="confirm-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3.9 2.5 18a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/></svg></span>
          <h5 class="fw-bold text-dark">{{ title }}</h5>
          <p class="text-muted small fw-semibold">{{ text }}</p>
          <div class="d-flex gap-2 mt-4">
            <button class="btn btn-soft flex-fill rounded-pill py-2" @click="$emit('cancel')">Cancelar</button>
            <button class="btn btn-danger flex-fill rounded-pill py-2 fw-bold" @click="$emit('confirm')">Confirmar</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps({ title: { type: String, default: 'Confirmar ação' }, text: { type: String, default: 'Deseja continuar?' } })
defineEmits(['confirm', 'cancel'])
</script>
