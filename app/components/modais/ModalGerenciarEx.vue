<template>
  <div class="modal fade show d-block gt-modal-backdrop">
    <div class="modal-dialog modal-xl modal-dialog-centered px-3">
      <div class="modal-content border-0 shadow-large trip-manager-modal">
        <div class="modal-header gt-modal-header align-items-start">
          <div class="trip-modal-title-wrap">
            <div class="d-flex flex-wrap align-items-center gap-2 mb-2">
              <h4 class="fw-bold mb-0">{{ excursaoSelecionada.nome }}</h4>
              <span class="badge-gt" :class="excursaoSelecionada.finalizada ? 'badge-finalizada' : 'badge-active-clean'">
                {{ excursaoSelecionada.finalizada ? 'Finalizada' : 'Ativa' }}
              </span>
            </div>
            <p class="text-muted mb-0">{{ excursaoSelecionada.lugar }}</p>
          </div>
          <button class="btn-close" @click="$emit('close')"></button>
        </div>

        <div class="modal-body p-3 p-md-4 pt-3">
          <section class="trip-command-center trip-command-center-v17">
            <div class="trip-status-strip trip-status-strip-clean trip-status-stack-v17">
              <div class="trip-status-item">
                <span>Ocupação</span>
                <strong>{{ ocupacao }}/{{ excursaoSelecionada.vagas }}</strong>
              </div>
              <div class="trip-status-item">
                <span>Espera</span>
                <strong>{{ filaEspera.length }}</strong>
              </div>
              <div class="trip-status-item">
                <span>Contrato</span>
                <strong>{{ excursaoSelecionada.ativarContrato ? 'Ativo' : 'Inativo' }}</strong>
              </div>
            </div>

            <div class="trip-action-panel trip-action-panel-v16 trip-action-panel-v17">
              <button class="gt-btn gt-btn-outline" @click="modalDownload = true">Baixar lista</button>
              <button class="gt-btn gt-btn-outline" @click="filaEspera.length ? (modalListaEspera = true) : showToast('Não há passageiros na lista de espera.', 'warning')">Lista de espera</button>
              <button class="gt-btn gt-btn-outline" :disabled="excursaoSelecionada.finalizada" @click="modalGrupos = true">Gerenciar grupos</button>
              <button class="gt-btn gt-btn-primary" @click="solicitarEdicao">{{ excursaoSelecionada.finalizada ? 'Editar finalizada' : 'Editar viagem' }}</button>
            </div>
          </section>

          <section class="passenger-list-shell mt-3 mt-md-4">
            <div class="passenger-list-header">
              <strong>Passageiros da viagem</strong>
              <span>{{ pluralPassageiros(usersLista.length) }}</span>
            </div>
            <div class="table-responsive passenger-table-scroll">
              <table class="table passenger-list-table passenger-list-table-v16 align-middle mb-0">
                <colgroup>
                  <col class="passenger-col-person">
                  <col class="passenger-col-payment">
                  <col class="passenger-col-contract">
                  <col class="passenger-col-actions">
                </colgroup>
                <thead>
                  <tr>
                    <th>Passageiro &amp; contato</th>
                    <th class="text-center">Pagamento</th>
                    <th class="text-center">Contrato</th>
                    <th class="text-end">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="u in usersLista" :key="u.id" class="passenger-line-v16" :class="{ 'passenger-dependent-line': ehDependente(u.id) }">
                    <td>
                      <div class="passenger-cell-person">
                        <div class="passenger-person-title">
                          <span v-if="ehDependente(u.id)" class="dependent-name-arrow" aria-hidden="true">↳</span>
                          <div>
                            <div class="fw-bold passenger-table-name" :class="{ 'dependent-table-name': ehDependente(u.id) }">{{ u.nome }}</div>
                            <div class="text-muted small">CPF: {{ maskCpf(u.cpf) }}</div>
                          </div>
                        </div>
                        <a class="whatsapp-button" :href="`https://wa.me/55${String(u.celular || '').replace(/\D/g, '')}`" target="_blank">Mensagem no WhatsApp</a>
                      </div>
                    </td>
                    <td class="text-center">
                      <button
                        v-if="!excursaoSelecionada.finalizada"
                        class="payment-badge payment-badge-v16"
                        :class="badgePagamentoClasse(obterPagamento(u.id))"
                        @click="abrirModalPagamento(u)"
                      >
                        {{ resumoPagamento(obterPagamento(u.id)) }}
                      </button>
                      <span v-else class="payment-badge payment-badge-v16" :class="badgePagamentoClasse(obterPagamento(u.id))">{{ resumoPagamento(obterPagamento(u.id)) }}</span>
                    </td>
                    <td class="text-center">
                      <div v-if="excursaoSelecionada.ativarContrato" class="contract-cell-v16">
                        <span v-if="ehDependente(u.id)" class="contract-status-muted">Dependente</span>
                        <button v-else-if="contratoAssinado(u.id)" class="gt-btn gt-btn-primary gt-btn-xs" @click="baixarContrato(u.id)">Baixar assinado</button>
                        <span v-else class="contract-status-pending">Pendente</span>
                      </div>
                      <span v-else class="contract-status-muted">Inativo</span>
                    </td>
                    <td class="text-end">
                      <button v-if="!excursaoSelecionada.finalizada" class="gt-btn gt-btn-danger-outline gt-btn-xs remove-passenger-btn" @click="$emit('desvincular', u.id)">Remover</button>
                      <span v-else class="text-muted small">Sem ação</span>
                    </td>
                  </tr>
                  <tr v-if="usersLista.length === 0">
                    <td colspan="4" class="text-center text-muted py-5">Nenhum passageiro vinculado a esta excursão.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>

    <ModaisModalPagamento
      v-if="showModalPagamento && usuarioPagamento"
      :usuario-pagamento="usuarioPagamento"
      :excursao-selecionada="excursaoSelecionada"
      @close="showModalPagamento = false"
      @atualizado="$emit('refresh')"
    />

    <div v-if="modalDownload" class="modal fade show d-block gt-modal-backdrop" style="z-index: 1070;">
      <div class="modal-dialog modal-dialog-centered px-3">
        <div class="modal-content border-0 shadow-large">
          <div class="modal-header gt-modal-header">
            <div>
              <h5 class="fw-bold mb-0">Baixar lista</h5>
              <p class="text-muted small mb-0">Marque as colunas que devem sair no arquivo.</p>
            </div>
            <button class="btn-close" @click="modalDownload = false"></button>
          </div>
          <div class="modal-body p-4">
            <div class="export-columns-grid mb-4">
              <label v-for="coluna in opcoesColunasLista" :key="coluna.id" class="export-column-option">
                <input v-model="colunasListaSelecionadas" class="form-check-input" type="checkbox" :value="coluna.id">
                <span>{{ coluna.label }}</span>
              </label>
            </div>
            <div class="download-options-clean">
              <button class="gt-btn gt-btn-outline" @click="baixarListaPDF">Baixar PDF</button>
              <button class="gt-btn gt-btn-primary" @click="baixarListaODT">Baixar ODT</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="modalListaEspera" class="modal fade show d-block gt-modal-backdrop" style="z-index: 1070;">
      <div class="modal-dialog modal-lg modal-dialog-centered px-3">
        <div class="modal-content border-0 shadow-large">
          <div class="modal-header gt-modal-header">
            <div>
              <h5 class="fw-bold mb-0">Lista de espera</h5>
              <p class="text-muted small mb-0">Passageiros aguardando vaga nesta viagem.</p>
            </div>
            <button class="btn-close" @click="modalListaEspera = false"></button>
          </div>
          <div class="modal-body p-0">
            <div v-if="filaEspera.length === 0" class="p-4 text-center text-muted">Não há passageiros na lista de espera.</div>
            <div v-else class="waitlist-card-list">
              <div v-for="item in filaEspera" :key="item.id" class="waitlist-card-row">
                <div class="passenger-cell-person waitlist-card-person">
                  <div class="passenger-person-title">
                    <div>
                      <div class="fw-bold passenger-table-name">{{ item.nome }}</div>
                      <div class="text-muted small">CPF: {{ maskCpf(item.cpf) }}</div>
                    </div>
                  </div>
                  <a class="whatsapp-button" :href="whatsappFila(item)" target="_blank">Mensagem no WhatsApp</a>
                </div>

                <div class="dropdown-gt waitlist-card-menu">
                  <button class="gt-icon-btn card-dots-btn" title="Ações da lista de espera" aria-label="Ações da lista de espera" @click.stop="toggleMenuFila(item.id)">
                    <span class="dots-menu"><span></span><span></span><span></span></span>
                  </button>
                  <div v-if="menuFilaId === item.id" class="dropdown-gt-menu waitlist-dropdown-menu">
                    <button @click="abrirAdicionarDaFila(item)">Adicionar</button>
                    <button @click="pedirRemoverDaFila(item)">Remover</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="modalGrupos" class="modal fade show d-block gt-modal-backdrop" style="z-index: 1075; overflow-y:auto">
      <div class="modal-dialog modal-lg modal-dialog-centered px-3">
        <div class="modal-content border-0 shadow-large">
          <div class="modal-header gt-modal-header">
            <div>
              <h5 class="fw-bold mb-0">Grupos familiares</h5>
              <p class="text-muted small mb-0">Crie grupos para definir titular e dependentes do contrato digital.</p>
            </div>
            <button class="btn-close" @click="modalGrupos = false"></button>
          </div>
          <div class="modal-body p-3 p-md-4 group-manager-body-v16">
            <section class="group-list-panel-v16">
              <div class="group-section-title">Grupos criados</div>
              <div v-if="gruposFormatados.length === 0" class="empty-group-state">Nenhum grupo criado ainda.</div>
              <div v-for="g in gruposFormatados" :key="g.lider.id" class="group-block-v16">
                <div class="group-leader-v16">
                  <div>
                    <span>Titular</span>
                    <strong>{{ g.lider.nome }}</strong>
                    <small>{{ maskCpf(g.lider.cpf) }}</small>
                  </div>
                  <button class="gt-btn gt-btn-danger-outline gt-btn-xs" @click="apagarGrupo(g.lider.id)">Apagar</button>
                </div>
                <div class="group-dependents-v16">
                  <span v-for="d in g.dependentes" :key="d.id">{{ d.nome }}</span>
                  <em v-if="g.dependentes.length === 0">Sem dependentes</em>
                </div>
              </div>
            </section>

            <section class="group-form-panel-v16">
              <div class="group-section-title">Novo grupo</div>
              <label class="form-label small fw-bold">Titular</label>
              <select v-model="novoGrupo.liderId" class="form-select mb-3">
                <option value="">Selecione o titular...</option>
                <option v-for="u in titularesDisponiveisGrupo" :key="u.id" :value="String(u.id)">{{ u.nome }}</option>
              </select>

              <label class="form-label small fw-bold">Buscar dependente</label>
              <input v-model="buscaDependenteGrupo" class="form-control mb-3" placeholder="Digite o nome ou CPF...">

              <div class="dependent-picker-v16">
                <label v-for="u in dependentesFiltrados" :key="u.id" class="dependent-option-v16">
                  <input v-model="novoGrupo.dependentesIds" type="checkbox" :value="String(u.id)" :disabled="String(u.id) === String(novoGrupo.liderId)">
                  <span>
                    <strong>{{ u.nome }}</strong>
                    <small>{{ maskCpf(u.cpf) }}</small>
                  </span>
                </label>
                <div v-if="dependentesFiltrados.length === 0" class="text-muted small p-3">Nenhum passageiro encontrado.</div>
              </div>

              <button class="gt-btn gt-btn-primary w-100 mt-3" @click="salvarGrupo">Salvar grupo</button>
            </section>
          </div>
        </div>
      </div>
    </div>

    <UiModalConfirm
      v-if="grupoParaApagar"
      title="Apagar grupo familiar"
      text="Tem certeza que deseja apagar este grupo? O titular e os dependentes continuarão na viagem, mas o vínculo de contrato será removido."
      @cancel="grupoParaApagar = null"
      @confirm="confirmarApagarGrupo"
    />

    <UiModalConfirm
      v-if="filaParaRemover"
      title="Remover da lista de espera"
      text="Tem certeza que deseja remover esta pessoa da lista de espera?"
      @cancel="filaParaRemover = null"
      @confirm="confirmarRemoverDaFila"
    />

    <div v-if="modalAdicionarFila && filaParaAdicionar" class="modal fade show d-block gt-modal-backdrop" style="z-index: 1080; overflow-y:auto">
      <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable px-3" style="max-width: 620px">
        <div class="modal-content border-0 shadow-large">
          <div class="modal-header gt-modal-header">
            <div>
              <h5 class="fw-bold mb-0">Adicionar passageiro</h5>
              <p class="text-muted small mb-0">Selecione o plano de pagamento e depois adicione parentes, se quiser.</p>
            </div>
            <button class="btn-close" @click="fecharAdicionarFila"></button>
          </div>

          <div class="modal-body p-4 bg-white">
            <div v-if="!filaMatriculada">
              <div class="gt-subtle-card p-3 mb-3">
                <strong>{{ filaParaAdicionar.nome }}</strong>
                <div class="text-muted small">CPF: {{ maskCpf(filaParaAdicionar.cpf) }}</div>
              </div>

              <label class="form-label small fw-bold">Pagamento principal</label>
              <select v-model="pagamentoFilaPrincipal" class="form-select rounded-gt py-3 mb-3">
                <option value="">Pendente / À combinar</option>
                <option value="Criança de 0 a 1,9 meses - Isento">Criança de 0 a 1,9 meses - Isento</option>
                <option v-for="(v,i) in excursaoSelecionada.valores" :key="i" :value="`${v.vezes}x de R$ ${v.valor}`">{{ v.vezes }}x de R$ {{ v.valor }}</option>
              </select>

              <div class="d-flex gap-2">
                <button class="gt-btn gt-btn-outline flex-fill" @click="fecharAdicionarFila">Cancelar</button>
                <button class="gt-btn gt-btn-primary flex-fill" :disabled="salvandoFila" @click="matricularFilaPrincipal">{{ salvandoFila ? 'Salvando...' : 'Adicionar' }}</button>
              </div>
            </div>

            <div v-else>
              <div class="alert alert-success border-0 rounded-gt">Passageiro adicionado. Agora você pode adicionar familiares como dependentes do contrato.</div>
              <div v-if="familiaresFila.length" class="mb-3">
                <input v-model="buscaParenteFila" class="form-control" placeholder="Buscar dependente...">
              </div>
              <div v-if="familiaresFilaFiltrados.length" class="d-grid gap-2">
                <div v-for="p in familiaresFilaFiltrados" :key="p.id" class="gt-card p-3 d-flex justify-content-between align-items-center gap-3">
                  <div><strong>{{ p.nome }}</strong><br><span class="text-muted small">CPF: {{ maskCpf(p.cpf) }}</span></div>
                  <button class="btn rounded-pill" :class="parentesFilaAdicionados.includes(p.id) ? 'btn-success' : 'btn-brand'" :disabled="parentesFilaAdicionados.includes(p.id) || salvandoFila" @click="prepararParenteFila(p)">
                    {{ parentesFilaAdicionados.includes(p.id) ? 'Adicionado' : 'Adicionar' }}
                  </button>
                </div>
              </div>
              <p v-else class="text-muted small mb-0">Nenhum parente encontrado para adicionar.</p>
            </div>
          </div>

          <div v-if="filaMatriculada" class="modal-footer bg-white">
            <button class="gt-btn gt-btn-primary w-100" @click="concluirAdicionarFila">Concluir</button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="parenteFilaSelecionado" class="modal fade show d-block" style="background: rgba(15,23,42,.55); z-index: 1090">
      <div class="modal-dialog modal-dialog-centered px-3" style="max-width: 430px">
        <div class="modal-content border-0 rounded-gt shadow-soft">
          <div class="modal-header border-0"><h5 class="fw-bold mb-0">Pagamento do dependente</h5><button class="btn-close" @click="parenteFilaSelecionado = null"></button></div>
          <div class="modal-body pt-0">
            <strong>{{ parenteFilaSelecionado.nome }}</strong>
            <select v-model="pagamentoParenteFila" class="form-select rounded-gt py-3 mt-3">
              <option value="">Pendente / À combinar</option>
              <option value="Criança de 0 a 1,9 meses - Isento">Criança de 0 a 1,9 meses - Isento</option>
              <option v-for="(v,i) in excursaoSelecionada.valores" :key="i" :value="`${v.vezes}x de R$ ${v.valor}`">{{ v.vezes }}x de R$ {{ v.valor }}</option>
            </select>
          </div>
          <div class="modal-footer border-0"><button class="gt-btn gt-btn-primary w-100" :disabled="salvandoFila" @click="matricularParenteFila">{{ salvandoFila ? 'Salvando...' : 'Confirmar dependente' }}</button></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { LISTA_PASSAGEIROS_COLUNAS, exportarListaODT, exportarListaPDF, gerarContratoAssinadoPDF, type ListaPassageiroColunaId } from '~/utils/exportacoes'

const props = defineProps<{ excursaoSelecionada: any }>()
const emit = defineEmits(['close', 'editar', 'editarFinalizada', 'desvincular', 'refresh'])
const { showToast } = useToasts()

const showModalPagamento = ref(false)
const usuarioPagamento = ref<any>(null)
const modalListaEspera = ref(false)
const modalGrupos = ref(false)
const modalDownload = ref(false)
const opcoesColunasLista = LISTA_PASSAGEIROS_COLUNAS
const colunasListaSelecionadas = ref<ListaPassageiroColunaId[]>(['nome', 'cpf', 'orgaoExpeditor'])
const buscaDependenteGrupo = ref('')
const grupoParaApagar = ref<number | null>(null)
const filaParaRemover = ref<any>(null)
const filaParaAdicionar = ref<any>(null)
const modalAdicionarFila = ref(false)
const filaMatriculada = ref(false)
const pagamentoFilaPrincipal = ref('')
const buscaParenteFila = ref('')
const familiaresFila = ref<any[]>([])
const parentesFilaAdicionados = ref<number[]>([])
const parenteFilaSelecionado = ref<any>(null)
const pagamentoParenteFila = ref('')
const salvandoFila = ref(false)
const menuFilaId = ref<number | string | null>(null)
const novoGrupo = ref<{ liderId: string; dependentesIds: string[] }>({ liderId: '', dependentesIds: [] })

const obterPagamento = (id: number) => props.excursaoSelecionada.pagamentos?.[String(id)] || 'Pendente'
const pluralPassageiros = (total: number) => `${total} ${total === 1 ? 'passageiro' : 'passageiros'}`
const resumoPagamento = (valor: string) => /isento/i.test(valor) ? 'Isento' : valor
const dependentesIds = computed(() => new Set(Object.values(props.excursaoSelecionada.grupos || {}).flat().map((id: any) => String(id))))
const ehDependente = (userId: number) => dependentesIds.value.has(String(userId))
const contratoAssinado = (userId: number) => {
  const assinaturas = props.excursaoSelecionada.assinaturas || {}
  return Boolean(assinaturas[String(userId)] && assinaturas[`admin_${userId}`])
}
const usersSorted = computed(() => [...(props.excursaoSelecionada.usuarios || [])].sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR')))
const usersLista = computed(() => {
  const usuarios = props.excursaoSelecionada.usuarios || []
  const grupos = props.excursaoSelecionada.grupos || {}
  const byId = new Map(usuarios.map((u: any) => [String(u.id), u]))
  const renderizados = new Set<string>()
  const resultado: any[] = []

  const adicionarUsuario = (id: string) => {
    const user = byId.get(String(id))
    if (user && !renderizados.has(String(user.id))) {
      resultado.push(user)
      renderizados.add(String(user.id))
    }
  }

  for (const usuario of usuarios) {
    const id = String(usuario.id)
    if (renderizados.has(id)) continue

    if (grupos[id]) {
      adicionarUsuario(id)
      for (const depId of grupos[id] || []) adicionarUsuario(String(depId))
    } else {
      const ehDependenteDeOutroGrupo = Object.values(grupos).some((deps: any) => (deps || []).map(String).includes(id))
      if (!ehDependenteDeOutroGrupo) adicionarUsuario(id)
    }
  }

  for (const usuario of usuarios) adicionarUsuario(String(usuario.id))
  return resultado
})
const ocupacao = computed(() => props.excursaoSelecionada._count?.usuarios || usersLista.value.length || 0)
const filaEspera = computed(() => props.excursaoSelecionada.listaEspera || [])
const gruposFormatados = computed(() => Object.entries(props.excursaoSelecionada.grupos || {}).map(([liderId, deps]: any) => ({
  lider: usersSorted.value.find((u: any) => String(u.id) === String(liderId)),
  dependentes: usersSorted.value.filter((u: any) => (deps || []).map(String).includes(String(u.id)))
})).filter((g: any) => g.lider))
const idsEmGrupos = computed(() => {
  const ids = new Set<string>()
  for (const [liderId, deps] of Object.entries(props.excursaoSelecionada.grupos || {})) {
    ids.add(String(liderId))
    for (const depId of (deps as any[]) || []) ids.add(String(depId))
  }
  return ids
})
const titularesDisponiveisGrupo = computed(() => usersSorted.value.filter((u: any) => !idsEmGrupos.value.has(String(u.id))))
const dependentesFiltrados = computed(() => {
  const q = buscaDependenteGrupo.value.toLowerCase().replace(/\D/g, '')
  const termo = buscaDependenteGrupo.value.toLowerCase().trim()
  return usersSorted.value.filter((u: any) => {
    if (String(u.id) === String(novoGrupo.value.liderId)) return false
    if (idsEmGrupos.value.has(String(u.id))) return false
    if (!termo) return true
    return String(u.nome || '').toLowerCase().includes(termo) || String(u.cpf || '').replace(/\D/g, '').includes(q)
  })
})
const familiaresFilaFiltrados = computed(() => {
  const termo = buscaParenteFila.value.toLowerCase().trim()
  const digits = termo.replace(/\D/g, '')
  if (!termo) return familiaresFila.value
  return familiaresFila.value.filter((p: any) => String(p.nome || '').toLowerCase().includes(termo) || String(p.cpf || '').replace(/\D/g, '').includes(digits))
})

const badgePagamentoClasse = (valor: string) => {
  if (/isento/i.test(valor)) return 'payment-badge-neutral'
  if (/pendente|combinar/i.test(valor)) return 'payment-badge-warn'
  return 'payment-badge-ok'
}
const maskCpf = (v: string) => {
  const digits = String(v || '').replace(/\D/g, '')
  return digits.length === 11 ? digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : v
}

const abrirModalPagamento = (u: any) => { usuarioPagamento.value = u; showModalPagamento.value = true }
const colunasExportacao = () => {
  if (colunasListaSelecionadas.value.length) return colunasListaSelecionadas.value
  showToast('Selecione pelo menos uma coluna para baixar a lista.', 'warning')
  return null
}
const baixarListaODT = () => {
  const colunas = colunasExportacao()
  if (!colunas) return
  exportarListaODT(props.excursaoSelecionada, showToast, colunas)
  modalDownload.value = false
}
const baixarListaPDF = async () => {
  const colunas = colunasExportacao()
  if (!colunas) return
  await exportarListaPDF(props.excursaoSelecionada, showToast, colunas)
  modalDownload.value = false
}
const baixarContrato = (userId: number) => gerarContratoAssinadoPDF(props.excursaoSelecionada, userId, showToast)
const solicitarEdicao = () => {
  if (props.excursaoSelecionada.finalizada) emit('editarFinalizada', props.excursaoSelecionada)
  else emit('editar')
}
const whatsappFila = (item: any) => {
  const msg = `Olá, ${String(item.nome || '').split(' ')[0] || 'tudo bem'}! Tudo bem? Aqui é da Grazi Turismo sobre a viagem ${props.excursaoSelecionada.nome}.`
  const phone = String(item.celular || '').replace(/\D/g, '')
  return phone ? `https://wa.me/55${phone}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`
}
const toggleMenuFila = (id: number | string) => { menuFilaId.value = menuFilaId.value === id ? null : id }
const abrirAdicionarDaFila = async (item: any) => {
  filaParaAdicionar.value = item
  menuFilaId.value = null
  modalAdicionarFila.value = true
  filaMatriculada.value = false
  pagamentoFilaPrincipal.value = ''
  buscaParenteFila.value = ''
  familiaresFila.value = []
  parentesFilaAdicionados.value = []
  parenteFilaSelecionado.value = null
  if (!item.userId) return
  try {
    const usuarios = await $fetch<any[]>('/api/users')
    const user = usuarios.find((u) => Number(u.id) === Number(item.userId))
    familiaresFila.value = (user?.parentes || []).filter((p: any) => !usersSorted.value.some((u: any) => Number(u.id) === Number(p.id)))
  } catch {
    familiaresFila.value = []
  }
}
const fecharAdicionarFila = () => {
  modalAdicionarFila.value = false
  filaParaAdicionar.value = null
  parenteFilaSelecionado.value = null
}
const pedirRemoverDaFila = (item: any) => { filaParaRemover.value = item; menuFilaId.value = null }
const confirmarRemoverDaFila = async () => {
  const item = filaParaRemover.value
  if (!item) return
  await $fetch(`/api/excursoes/${props.excursaoSelecionada.id}/espera`, { method: 'DELETE', body: { entradaId: item.id, userId: item.userId, cpf: item.cpf } })
  filaParaRemover.value = null
  showToast('Passageiro removido da lista de espera.', 'success')
  emit('refresh')
}
const matricularFilaPrincipal = async () => {
  const item = filaParaAdicionar.value
  if (!item) return
  salvandoFila.value = true
  try {
    if (!item.userId) {
      showToast('Este registro da lista de espera não está vinculado a um passageiro válido do banco.', 'warning')
      return
    }
    await $fetch('/api/vincular', { method: 'POST', body: { userId: item.userId, excursaoId: props.excursaoSelecionada.id, opcaoPagamento: pagamentoFilaPrincipal.value } })
    await $fetch(`/api/excursoes/${props.excursaoSelecionada.id}/espera`, { method: 'DELETE', body: { entradaId: item.id, userId: item.userId, cpf: item.cpf } })
    showToast('Passageiro adicionado à viagem.', 'success')
    filaMatriculada.value = true
    emit('refresh')
  } catch (e: any) {
    showToast(e.data?.statusMessage || 'Não foi possível adicionar o passageiro à viagem.', 'danger')
  } finally {
    salvandoFila.value = false
  }
}
const prepararParenteFila = (p: any) => { parenteFilaSelecionado.value = p; pagamentoParenteFila.value = '' }
const matricularParenteFila = async () => {
  if (!parenteFilaSelecionado.value || !filaParaAdicionar.value) return
  salvandoFila.value = true
  try {
    await $fetch('/api/vincular', { method: 'POST', body: { userId: parenteFilaSelecionado.value.id, excursaoId: props.excursaoSelecionada.id, opcaoPagamento: pagamentoParenteFila.value, liderId: filaParaAdicionar.value.userId } })
    await $fetch(`/api/excursoes/${props.excursaoSelecionada.id}/espera`, { method: 'DELETE', body: { userId: parenteFilaSelecionado.value.id, cpf: parenteFilaSelecionado.value.cpf } }).catch(() => null)
    parentesFilaAdicionados.value.push(parenteFilaSelecionado.value.id)
    parenteFilaSelecionado.value = null
    showToast('Dependente adicionado ao contrato.', 'success')
    emit('refresh')
  } catch (e: any) {
    showToast(e.data?.statusMessage || 'NÃ£o foi possÃ­vel adicionar o dependente. Verifique vagas, duplicidade ou dados da viagem.', 'danger')
  } finally {
    salvandoFila.value = false
  }
}
const concluirAdicionarFila = () => {
  fecharAdicionarFila()
  emit('refresh')
}
const payloadBase = (grupos: Record<string, string[]>) => ({
  ...props.excursaoSelecionada,
  valores: JSON.stringify(props.excursaoSelecionada.valores || []),
  pagamentosJson: JSON.stringify(props.excursaoSelecionada.pagamentos || {}),
  contratoDetalhes: JSON.stringify(props.excursaoSelecionada.detalhes || {}),
  contratoGrupos: JSON.stringify(grupos),
  despesasJson: JSON.stringify(props.excursaoSelecionada.despesas || []),
  mostrarAberta: props.excursaoSelecionada.mostrarAberta ?? true
})
const salvarGrupo = async () => {
  if (!novoGrupo.value.liderId || novoGrupo.value.dependentesIds.length === 0) {
    showToast('Selecione um titular e pelo menos um dependente.', 'warning')
    return
  }
  const grupos = { ...(props.excursaoSelecionada.grupos || {}) }
  grupos[String(novoGrupo.value.liderId)] = [...new Set(novoGrupo.value.dependentesIds.map(String).filter((id) => id !== String(novoGrupo.value.liderId)))]

  await $fetch(`/api/excursoes/${props.excursaoSelecionada.id}`, {
    method: 'PUT',
    body: payloadBase(grupos)
  })

  showToast('Grupo familiar salvo.', 'success')
  novoGrupo.value = { liderId: '', dependentesIds: [] }
  buscaDependenteGrupo.value = ''
  emit('refresh')
}
const apagarGrupo = (liderId: number) => { grupoParaApagar.value = liderId }
const confirmarApagarGrupo = async () => {
  if (!grupoParaApagar.value) return
  const grupos = { ...(props.excursaoSelecionada.grupos || {}) }
  delete grupos[String(grupoParaApagar.value)]
  await $fetch(`/api/excursoes/${props.excursaoSelecionada.id}`, {
    method: 'PUT',
    body: payloadBase(grupos)
  })
  grupoParaApagar.value = null
  showToast('Grupo removido.', 'success')
  emit('refresh')
}
</script>
