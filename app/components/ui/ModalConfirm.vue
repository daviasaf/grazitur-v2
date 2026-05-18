<template>
  <div class="modal fade show d-block" style="background: rgba(15,23,42,.55); z-index: 1095">
    <div class="modal-dialog modal-dialog-centered px-3" style="max-width: 420px">
      <div class="modal-content border-0 rounded-gt shadow-soft">
        <div class="modal-body p-4 text-center">
          <div class="fs-1 mb-2">!</div>
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
