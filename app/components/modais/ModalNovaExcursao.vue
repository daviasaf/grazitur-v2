<template>
  <div class="modal fade show d-block" style="background: rgba(15,23,42,.58); z-index: 1060; overflow-y:auto">
    <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable px-3">
      <div class="modal-content border-0 shadow-large">
        <div class="modal-header bg-white">
          <div>
            <h5 class="fw-bold mb-1">{{ tituloModal }}</h5>
            <p v-if="form.finalizada" class="text-muted small mb-0">Esta excursão está finalizada, mas pode receber ajustes manuais no cadastro.</p>
          </div>
          <button class="btn-close" @click="$emit('close')"></button>
        </div>

        <div class="modal-body bg-white p-4">
          <div class="row g-3">
            <div class="col-12">
              <label class="form-label small fw-bold">Nome da viagem *</label>
              <input v-model="form.nome" class="form-control" placeholder="Ex: Beto Carrero">
            </div>
            <div class="col-md-8">
              <label class="form-label small fw-bold">Destino *</label>
              <input v-model="form.lugar" class="form-control" placeholder="Ex: Balneário Camboriú">
            </div>
            <div class="col-md-4">
              <label class="form-label small fw-bold">Vagas *</label>
              <input v-model="form.vagas" type="number" class="form-control">
            </div>

            <div class="col-12">
              <div class="gt-subtle-card p-3">
                <div class="d-flex flex-column flex-md-row justify-content-between gap-2 align-items-md-center mb-3">
                  <div>
                    <strong>Valores da viagem</strong>
                    <p class="text-muted small mb-0">Use sempre o valor da parcela. O sistema calcula a receita automaticamente.</p>
                  </div>
                </div>
                <div class="row g-2 mb-3">
                  <div class="col-md-5">
                    <input :value="novoValor" class="form-control" inputmode="numeric" placeholder="Ex: 680,00" @input="e => novoValor = mascaraDinheiro((e.target as HTMLInputElement).value)">
                  </div>
                  <div class="col-md-4"><input v-model="novasVezes" type="number" min="1" class="form-control" placeholder="Vezes"></div>
                  <div class="col-md-3"><button class="gt-btn gt-btn-primary w-100" @click="adicionarValor">Adicionar</button></div>
                </div>
                <div class="d-flex flex-wrap gap-2">
                  <span v-for="(v, i) in form.valores" :key="i" class="badge-gt bg-white text-dark border d-inline-flex align-items-center gap-2">
                    {{ v.vezes }}x de R$ {{ v.valor }}
                    <button class="btn btn-sm p-0 text-danger border-0" @click="removerValor(i)">×</button>
                  </span>
                  <span v-if="form.valores.length === 0" class="text-muted small">Nenhum valor adicionado.</span>
                </div>
              </div>
            </div>

            <div class="col-12">
              <div class="gt-card p-3 p-md-4">
                <div class="d-flex justify-content-between align-items-start gap-3 flex-wrap mb-3">
                  <div>
                    <h6 class="fw-bold mb-1">Dados do contrato</h6>
                    <p class="text-muted small mb-0">Preencha antes de ativar o contrato. Estes dados são opcionais.</p>
                  </div>
                  <span class="badge-gt bg-white text-muted border">Opcional</span>
                </div>
                <div class="row g-3">
                  <div class="col-md-3"><label class="form-label small">Data saída</label><input :value="form.detalhes.dataSaida" @input="e => form.detalhes.dataSaida = mascaraData((e.target as HTMLInputElement).value)" class="form-control" maxlength="10" placeholder="dd/mm/aaaa"></div>
                  <div class="col-md-3"><label class="form-label small">Hora saída</label><input :value="form.detalhes.horaSaida" @input="e => form.detalhes.horaSaida = mascaraHora((e.target as HTMLInputElement).value)" class="form-control" maxlength="5" placeholder="00:00"></div>
                  <div class="col-md-3"><label class="form-label small">Data retorno</label><input :value="form.detalhes.dataRetorno" @input="e => form.detalhes.dataRetorno = mascaraData((e.target as HTMLInputElement).value)" class="form-control" maxlength="10" placeholder="dd/mm/aaaa"></div>
                  <div class="col-md-3"><label class="form-label small">Hora retorno</label><input :value="form.detalhes.horaRetorno" @input="e => form.detalhes.horaRetorno = mascaraHora((e.target as HTMLInputElement).value)" class="form-control" maxlength="5" placeholder="00:00"></div>
                  <div class="col-md-6"><label class="form-label small">Transporte</label><input v-model="form.detalhes.transporte" class="form-control"></div>
                  <div class="col-md-6"><label class="form-label small">Empresa</label><input v-model="form.detalhes.empresa" class="form-control"></div>
                  <div class="col-12"><label class="form-label small">Roteiro / serviços</label><textarea v-model="form.detalhes.roteiro" class="form-control" rows="4"></textarea></div>
                </div>
              </div>
            </div>

            <div class="col-12">
              <div class="gt-card p-3 d-flex align-items-center justify-content-between gap-3 contract-toggle-card">
                <div>
                  <label class="fw-bold mb-0" for="contrato">Ativar contrato</label>
                  <p class="text-muted small mb-0">Ao ativar, os contratos passam a sair assinados pelo guia responsável. Só é possível ativar se houver guia vinculado.</p>
                </div>
                <div class="form-check form-switch m-0">
                  <input id="contrato" v-model="form.ativarContrato" class="form-check-input fs-4 m-0" type="checkbox">
                </div>
              </div>
            </div>

            <div class="col-12">
              <div class="gt-card p-3 d-flex align-items-center justify-content-between gap-3 contract-toggle-card open-trip-toggle-card">
                <div>
                  <label class="fw-bold mb-0" for="mostrarAberta">Mostrar em Excursões Abertas</label>
                  <p class="text-muted small mb-0">Quando marcado, a viagem aparece para o passageiro demonstrar interesse e entrar na lista de espera.</p>
                </div>
                <div class="form-check form-switch m-0">
                  <input id="mostrarAberta" v-model="form.mostrarAberta" class="form-check-input fs-4 m-0" type="checkbox">
                </div>
              </div>
            </div>

            <div class="col-12">
              <label class="form-label small fw-bold">Guia responsável</label>
              <select v-model="form.guiaId" class="form-select">
                <option :value="null">Nenhum guia vinculado</option>
                <option v-for="g in guiasDisponiveis" :key="g.id" :value="g.id">{{ g.nome }}</option>
              </select>
            </div>

            <div class="col-12">
              <div class="gt-subtle-card p-3 small">
                <strong>Resumo:</strong>
                {{ form.usuarios?.length || form._count?.usuarios || 0 }} passageiros cadastrados, {{ form.vagas }} vagas totais.
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer bg-white d-flex gap-2">
          <button v-if="form.id" class="gt-btn gt-btn-danger-outline me-auto" @click="$emit('apagar', form.id)">Apagar excursão</button>
          <button v-if="form.id && !form.finalizada" class="gt-btn gt-btn-warning" @click="$emit('finalizar', form.id)">Finalizar excursão</button>
          <button class="gt-btn gt-btn-outline" @click="$emit('close')">Cancelar</button>
          <button class="gt-btn gt-btn-primary" @click="salvar">{{ form.finalizada ? 'Salvar alterações' : 'Salvar excursão' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { mascaraData, mascaraDinheiro, mascaraHora } from '~/utils/formatadores'
const props = defineProps<{ excursaoEditando?: any; guiasDisponiveis: any[] }>()
const emit = defineEmits(['close', 'salvo', 'apagar', 'finalizar'])
const { showToast } = useToasts()

const form = ref({
  id: null as number | null,
  nome: '', lugar: '', vagas: '', guiaId: null as number | null,
  valores: [] as Array<{ valor: string; vezes: number }>,
  ativarContrato: false,
  detalhes: { dataSaida: '', horaSaida: '', dataRetorno: '', horaRetorno: '', transporte: '', empresa: '', roteiro: '' },
  grupos: {}, pagamentos: {}, despesas: [], usuarios: [] as any[], mostrarAberta: true, finalizada: false
})
const novoValor = ref('')
const novasVezes = ref('')
const tituloModal = computed(() => form.value.finalizada ? 'Editar excursão finalizada' : form.value.id ? 'Editar excursão' : 'Nova excursão')

onMounted(() => {
  if (props.excursaoEditando) {
    const cloned = JSON.parse(JSON.stringify({ ...form.value, ...props.excursaoEditando }))
    cloned.valores = (cloned.valores || []).map((item: any) => ({ ...item, valor: String(item.valor ?? '') }))
    form.value = cloned
  }
})

const adicionarValor = () => {
  if (!novoValor.value || !novasVezes.value) return
  form.value.valores.push({ valor: novoValor.value, vezes: Number(novasVezes.value) })
  novoValor.value = ''
  novasVezes.value = ''
}
const removerValor = (i: number) => form.value.valores.splice(i, 1)

const salvar = async () => {
  if (!form.value.nome || !form.value.lugar || !form.value.vagas || form.value.valores.length === 0) {
    showToast('Preencha nome, destino, vagas e pelo menos um valor.', 'warning')
    return
  }
  if (form.value.ativarContrato && !form.value.guiaId) {
    showToast('Selecione um guia antes de ativar o contrato.', 'warning')
    return
  }
  const method = form.value.id ? 'PUT' : 'POST'
  const url = form.value.id ? `/api/excursoes/${form.value.id}` : '/api/excursoes'
  await $fetch(url, {
    method,
    body: {
      ...form.value,
      mostrarAberta: form.value.mostrarAberta,
      valores: JSON.stringify(form.value.valores),
      aplicarParcelas: true,
      liberarContratos: form.value.ativarContrato,
      contratoDetalhes: JSON.stringify(form.value.detalhes || {}),
      contratoGrupos: JSON.stringify(form.value.grupos || {}),
      pagamentosJson: JSON.stringify(form.value.pagamentos || {}),
      despesasJson: JSON.stringify(form.value.despesas || [])
    }
  })
  showToast(form.value.finalizada ? 'Excursão finalizada atualizada.' : 'Excursão salva.', 'success')
  emit('salvo')
  emit('close')
}
</script>
