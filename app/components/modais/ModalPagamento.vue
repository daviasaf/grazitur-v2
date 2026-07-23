<template>
  <div class="modal fade show d-block gt-modal-backdrop" style="z-index: 1070">
    <div class="modal-dialog modal-dialog-centered px-3" style="max-width: 460px">
      <div class="modal-content border-0 rounded-gt shadow-soft">
        <div class="modal-header border-0 pb-0">
          <h5 class="fw-bold">Alterar pagamento</h5>
          <button class="btn-close" @click="$emit('close')"></button>
        </div>
        <div class="modal-body p-4">
          <div class="badge bg-brand-soft text-brand mb-3 px-3 py-2 rounded-pill">{{ usuarioPagamento.nome }}</div>
          <select v-model="novoPagamento" class="form-select rounded-gt py-3 fw-bold">
            <option value="">Pendente / À combinar</option>
            <option value="Criança de 0 a 1,9 meses - Isento">Isento</option>
            <option v-for="(v, i) in excursaoSelecionada.valores" :key="i" :value="`${v.vezes}x de R$ ${v.valor}`">{{ v.vezes }}x de R$ {{ v.valor }}</option>
          </select>
          <p class="payment-help-text mt-2 mb-0">Isento: criança de 0 a 1,9 meses.</p>
        </div>
        <div class="modal-footer border-0 pt-0">
          <button class="btn btn-brand rounded-pill px-4 w-100" @click="salvar">Salvar</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ usuarioPagamento: any; excursaoSelecionada: any }>()
const emit = defineEmits(['close', 'atualizado'])
const { showToast } = useToasts()
const novoPagamento = ref('')

onMounted(() => {
  novoPagamento.value = props.excursaoSelecionada.pagamentos?.[String(props.usuarioPagamento.id)] || ''
})

const salvar = async () => {
  const ex = props.excursaoSelecionada
  const pagamentos = { ...(ex.pagamentos || {}) }
  if (novoPagamento.value) pagamentos[String(props.usuarioPagamento.id)] = novoPagamento.value
  else delete pagamentos[String(props.usuarioPagamento.id)]

  await $fetch(`/api/excursoes/${ex.id}`, {
    method: 'PUT',
    body: {
      ...ex,
      valores: JSON.stringify(ex.valores || []),
      pagamentosJson: JSON.stringify(pagamentos),
      contratoDetalhes: JSON.stringify(ex.detalhes || {}),
      contratoGrupos: JSON.stringify(ex.grupos || {}),
      despesasJson: JSON.stringify(ex.despesas || [])
    }
  })
  await $fetch('/api/logs', {
    method: 'POST',
    body: {
      entity: 'financeiro',
      action: 'payment-update',
      title: 'Pagamento de passageiro atualizado',
      detail: `${props.usuarioPagamento.nome} teve o pagamento alterado para ${novoPagamento.value || 'Pendente / À combinar'} na excursão ${ex.nome}.`
    }
  })
  showToast('Pagamento atualizado. Assinaturas dessa excursão foram reiniciadas se necessário.', 'success')
  emit('atualizado')
  emit('close')
}
</script>
