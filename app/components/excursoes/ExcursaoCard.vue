<template>
  <div class="gt-card gt-card-hover p-3 h-100 cursor-pointer" @click="$emit('gerenciar', excursao)">
    <div class="d-flex justify-content-between gap-3 mb-2">
      <div class="min-w-0">
        <h5 class="excursion-card-title mb-1 text-truncate">{{ excursao.nome }}</h5>
        <p class="text-muted small mb-0 lh-sm">Destino: {{ excursao.lugar }}</p>
      </div>
      <span v-if="excursao.finalizada" class="badge-gt badge-finalizada align-self-start">Finalizada</span>
      <span v-else-if="excursao.ativarContrato" class="badge-gt badge-contract align-self-start">Contrato</span>
    </div>

    <div class="excursion-info-box mt-3">
      <div class="d-flex justify-content-between align-items-center small mb-2 gap-2">
        <span class="text-muted text-nowrap">Guia Responsável:</span>
        <strong class="text-truncate" :title="excursao.guia?.nome || 'Pendente'">{{ nomeGuia }}</strong>
      </div>
      <div class="progress gt-progress">
        <div class="progress-bar" :class="lotada ? 'bg-danger' : 'bg-brand'" :style="{ width: progresso + '%' }"></div>
      </div>
      <div class="text-center small text-muted mt-2">{{ ocupadas }} / {{ excursao.vagas }} vagas</div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ excursao: any }>()
defineEmits(['gerenciar'])
const ocupadas = computed(() => props.excursao._count?.usuarios || props.excursao.usuarios?.length || 0)
const progresso = computed(() => Math.min(100, props.excursao.vagas ? (ocupadas.value / props.excursao.vagas) * 100 : 0))
const lotada = computed(() => ocupadas.value >= props.excursao.vagas)
const nomeGuia = computed(() => props.excursao.guia?.nome || 'Pendente')
</script>
