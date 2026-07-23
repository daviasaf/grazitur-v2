<template>
  <div class="modal fade show d-block gt-modal-backdrop" style="z-index: 1070">
    <div class="modal-dialog modal-dialog-centered px-3" style="max-width: 470px">
      <div class="modal-content border-0 shadow-large">
        <div class="modal-header border-0 pb-0">
          <div>
            <h5 class="fw-bold mb-1">Nova despesa</h5>
            <p class="text-muted small mb-0">{{ selectedExcursao?.nome || 'Selecione uma excursão ativa' }}</p>
          </div>
          <button class="btn-close" @click="$emit('close')"></button>
        </div>
        <div class="modal-body p-4">
          <label v-if="!props.excursao" class="form-label small fw-bold">Excursão</label>
          <select v-if="!props.excursao" v-model="selectedId" class="form-select mb-3">
            <option value="">Selecione</option>
            <option v-for="ex in excursoes" :key="ex.id" :value="ex.id">{{ ex.nome }}</option>
          </select>

          <label class="form-label small fw-bold">Descrição</label>
          <input v-model="descricao" class="form-control mb-3" placeholder="Ex: Hotel, ônibus, ingresso">

          <label class="form-label small fw-bold">Valor (R$)</label>
          <input v-model="valor" type="number" min="0" step="0.01" class="form-control mb-3" placeholder="Ex: 2000">


          <label class="form-label small fw-bold">Data</label>
          <input v-model="data" type="date" class="form-control mb-3">

          <div class="gt-subtle-card p-3 small text-muted">
            Essa despesa será somada aos gastos e descontada automaticamente no lucro do dashboard.
          </div>
        </div>
        <div class="modal-footer border-0 pt-0">
          <button class="gt-btn gt-btn-outline" @click="$emit('close')">Cancelar</button>
          <button class="gt-btn gt-btn-primary" @click="salvar" :disabled="carregando">Salvar despesa</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ excursao?: any | null; excursoes?: any[] }>()
const emit = defineEmits(['close', 'salvo'])
const { showToast } = useToasts()
const selectedId = ref(props.excursao?.id || '')
const descricao = ref('')
const valor = ref('')
const data = ref(new Date().toISOString().slice(0, 10))
const carregando = ref(false)
const excursoes = computed(() => props.excursoes || [])
const selectedExcursao = computed(() => props.excursao || excursoes.value.find((ex) => String(ex.id) === String(selectedId.value)))

const salvar = async () => {
  if (!selectedExcursao.value) {
    showToast('Selecione uma excursão.', 'warning')
    return
  }
  if (!valor.value) {
    showToast('Informe o valor da despesa.', 'warning')
    return
  }

  carregando.value = true
  try {
    await $fetch(`/api/excursoes/${selectedExcursao.value.id}/despesas`, {
      method: 'POST',
      body: { descricao: descricao.value || 'Despesa', valor: valor.value, data: data.value }
    })
    showToast('Despesa adicionada.', 'success')
    emit('salvo')
    emit('close')
  } catch (e: any) {
    showToast(e.data?.statusMessage || 'Erro ao adicionar despesa.', 'danger')
  } finally {
    carregando.value = false
  }
}
</script>
