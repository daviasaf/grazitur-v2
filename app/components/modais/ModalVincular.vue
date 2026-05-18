<template>
  <div class="modal fade show d-block" style="background: rgba(15,23,42,.55); z-index: 1060; overflow-y:auto">
    <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable px-3" style="max-width: 620px">
      <div class="modal-content border-0 rounded-gt shadow-soft">
        <div class="modal-header bg-white">
          <div><h5 class="fw-bold mb-0">Matricular {{ userParaVincular.nome }}</h5><p class="text-muted small mb-0">Selecione a excursão, o plano e depois os parentes se quiser.</p></div>
          <button class="btn-close" @click="$emit('close')"></button>
        </div>
        <div class="modal-body p-4 bg-white">
          <div v-if="!excursaoSelecionada" class="d-grid gap-2">
            <button v-for="ex in excursoes" :key="ex.id" class="btn btn-soft text-start p-3 rounded-gt" :disabled="ocupadas(ex) >= ex.vagas" @click="selecionar(ex)">
              <strong>{{ ex.nome }}</strong><br><span class="text-muted small">{{ ex.lugar }} • {{ ocupadas(ex) }}/{{ ex.vagas }} vagas</span>
            </button>
          </div>

          <div v-else-if="!matriculado">
            <h6 class="fw-bold">Pagamento principal</h6>
            <select v-model="pagamentoPrincipal" class="form-select rounded-gt py-3 mb-3">
              <option value="">Pendente / À combinar</option>
              <option value="Criança de 0 a 1,9 meses - Isento">Criança de 0 a 1,9 meses - Isento</option>
              <option v-for="(v,i) in excursaoSelecionada.valores" :key="i" :value="`${v.vezes}x de R$ ${v.valor}`">{{ v.vezes }}x de R$ {{ v.valor }}</option>
            </select>
            <div class="d-flex gap-2">
              <button class="btn btn-soft flex-fill rounded-pill" @click="excursaoSelecionada = null">Voltar</button>
              <button class="btn btn-brand flex-fill rounded-pill" :disabled="salvando" @click="matricularPrincipal">{{ salvando ? 'Salvando...' : 'Matricular' }}</button>
            </div>
          </div>

          <div v-else>
            <div class="alert alert-success border-0 rounded-gt">Passageiro matriculado. Agora você pode adicionar os familiares como dependentes do contrato.</div>
            <div v-if="familiares.length" class="mb-3">
              <input v-model="buscaParente" class="form-control" placeholder="Buscar dependente...">
            </div>
            <div v-if="familiaresFiltrados.length" class="d-grid gap-2">
              <div v-for="p in familiaresFiltrados" :key="p.id" class="gt-card p-3 d-flex justify-content-between align-items-center gap-3">
                <div><strong>{{ p.nome }}</strong><br><span class="text-muted small">CPF: {{ p.cpf }}</span></div>
                <button class="btn rounded-pill" :class="adicionados.includes(p.id) ? 'btn-success' : 'btn-brand'" :disabled="adicionados.includes(p.id) || salvando" @click="prepararParente(p)">
                  {{ adicionados.includes(p.id) ? 'Adicionado' : 'Adicionar' }}
                </button>
              </div>
            </div>
            <p v-else class="text-muted small mb-0">Nenhum parente encontrado para adicionar.</p>
          </div>
        </div>
        <div v-if="matriculado" class="modal-footer bg-white">
          <button class="btn btn-brand rounded-pill w-100" @click="$emit('close')">Concluir</button>
        </div>
      </div>
    </div>

    <div v-if="parenteSelecionado" class="modal fade show d-block" style="background: rgba(15,23,42,.55); z-index: 1080">
      <div class="modal-dialog modal-dialog-centered px-3" style="max-width: 430px">
        <div class="modal-content border-0 rounded-gt shadow-soft">
          <div class="modal-header border-0"><h5 class="fw-bold mb-0">Pagamento do dependente</h5><button class="btn-close" @click="parenteSelecionado = null"></button></div>
          <div class="modal-body pt-0">
            <strong>{{ parenteSelecionado.nome }}</strong>
            <select v-model="pagamentoParente" class="form-select rounded-gt py-3 mt-3">
              <option value="">Pendente / À combinar</option>
              <option value="Criança de 0 a 1,9 meses - Isento">Criança de 0 a 1,9 meses - Isento</option>
              <option v-for="(v,i) in excursaoSelecionada.valores" :key="i" :value="`${v.vezes}x de R$ ${v.valor}`">{{ v.vezes }}x de R$ {{ v.valor }}</option>
            </select>
          </div>
          <div class="modal-footer border-0"><button class="btn btn-brand rounded-pill w-100" :disabled="salvando" @click="matricularParente">{{ salvando ? 'Salvando...' : 'Confirmar dependente' }}</button></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ userParaVincular: any; excursoes: any[] }>()
const emit = defineEmits(['close', 'atualizado', 'matriculado'])
const { showToast } = useToasts()
const excursaoSelecionada = ref<any>(null)
const pagamentoPrincipal = ref('')
const matriculado = ref(false)
const adicionados = ref<number[]>([])
const parenteSelecionado = ref<any>(null)
const pagamentoParente = ref('')
const buscaParente = ref('')
const salvando = ref(false)
const familiares = computed(() => props.userParaVincular.parentes || [])
const familiaresFiltrados = computed(() => {
  const q = buscaParente.value.toLowerCase().trim()
  if (!q) return familiares.value
  return familiares.value.filter((p: any) => String(p.nome || '').toLowerCase().includes(q) || String(p.cpf || '').includes(q))
})
const ocupadas = (ex: any) => ex._count?.usuarios || ex.usuarios?.length || 0
const selecionar = (ex: any) => { excursaoSelecionada.value = ex; pagamentoPrincipal.value = ''; matriculado.value = false; buscaParente.value = ''; adicionados.value = [] }

const matricularPrincipal = async () => {
  salvando.value = true
  try {
    await $fetch('/api/vincular', { method: 'POST', body: { userId: props.userParaVincular.id, excursaoId: excursaoSelecionada.value.id, opcaoPagamento: pagamentoPrincipal.value } })
    showToast('Passageiro matriculado.', 'success')
    matriculado.value = true
    emit('matriculado')
    emit('atualizado')
  } catch (e: any) {
    showToast(e.data?.statusMessage || 'Não foi possível matricular o passageiro.', 'danger')
  } finally {
    salvando.value = false
  }
}
const prepararParente = (p: any) => { parenteSelecionado.value = p; pagamentoParente.value = '' }
const matricularParente = async () => {
  salvando.value = true
  try {
    await $fetch('/api/vincular', { method: 'POST', body: { userId: parenteSelecionado.value.id, excursaoId: excursaoSelecionada.value.id, opcaoPagamento: pagamentoParente.value, liderId: props.userParaVincular.id } })
    adicionados.value.push(parenteSelecionado.value.id)
    parenteSelecionado.value = null
    showToast('Dependente adicionado ao contrato.', 'success')
    emit('atualizado')
  } catch (e: any) {
    showToast(e.data?.statusMessage || 'Não foi possível adicionar o dependente. Verifique vagas, duplicidade ou dados da viagem.', 'danger')
  } finally {
    salvando.value = false
  }
}
</script>
