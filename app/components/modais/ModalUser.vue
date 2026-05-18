<template>
  <div class="modal fade show d-block gt-modal-backdrop">
    <div class="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable px-3">
      <div class="modal-content border-0 shadow-large">
        <div class="modal-header gt-modal-header">
          <div>
            <h5 class="fw-bold mb-1">{{ form.id ? 'Editar passageiro' : 'Novo passageiro' }}</h5>
            <p class="text-muted small mb-0">Todos os dados são obrigatórios, exceto RG.</p>
          </div>
          <button class="btn-close" @click="$emit('close')"></button>
        </div>

        <div class="modal-body bg-white p-4">
          <div v-if="erro" class="alert alert-danger rounded-gt border-0 fw-semibold small">{{ erro }}</div>

          <div class="row g-3">
            <div class="col-lg-6">
              <div class="gt-subtle-card p-3 p-md-4 h-100">
                <h6 class="fw-bold mb-3">Dados pessoais</h6>
                <div class="row g-3">
                  <div class="col-12">
                    <label class="form-label small fw-bold">Nome completo *</label>
                    <input v-model="form.nome" class="form-control" placeholder="Nome do passageiro">
                  </div>
                  <div class="col-12">
                    <label class="form-label small fw-bold">E-mail *</label>
                    <input v-model="form.email" type="email" class="form-control" placeholder="email@exemplo.com">
                  </div>
                  <div class="col-md-6">
                    <label class="form-label small fw-bold">CPF *</label>
                    <input :value="form.cpf" maxlength="14" class="form-control" placeholder="000.000.000-00" @input="e => form.cpf = mascaraCPF((e.target as HTMLInputElement).value)">
                  </div>
                  <div class="col-md-6">
                    <label class="form-label small fw-bold">RG</label>
                    <input v-model="form.rg" class="form-control" placeholder="Opcional">
                  </div>
                  <div class="col-md-6">
                    <label class="form-label small fw-bold">Nascimento *</label>
                    <input :value="form.nascimento" maxlength="10" class="form-control" placeholder="DD/MM/AAAA" @input="e => form.nascimento = mascaraData((e.target as HTMLInputElement).value)">
                  </div>
                  <div class="col-md-6">
                    <label class="form-label small fw-bold">Idade *</label>
                    <input v-model="form.idade" type="number" min="0" class="form-control" placeholder="Opcional">
                  </div>
                  <div class="col-12">
                    <label class="form-label small fw-bold">Órgão expeditor *</label>
                    <select v-model="selecaoOrgao" class="form-select" @change="handleOrgaoChange">
                      <option value="" disabled>Selecione...</option>
                      <option v-for="op in opcoesOrgao" :key="op" :value="op">{{ op }}</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div class="col-lg-6">
              <div class="gt-subtle-card p-3 p-md-4 h-100">
                <h6 class="fw-bold mb-3">Contato e endereço</h6>
                <div class="row g-3">
                  <div class="col-12">
                    <label class="form-label small fw-bold">Celular / WhatsApp *</label>
                    <input :value="form.celular" maxlength="15" class="form-control" placeholder="(22) 99999-9999" @input="e => form.celular = mascaraCelular((e.target as HTMLInputElement).value)">
                  </div>
                  <div class="col-md-4">
                    <label class="form-label small fw-bold">Estado *</label>
                    <select v-model="estadoSelecionado" class="form-select" :disabled="carregandoEstados" @change="buscarCidades">
                      <option value="" disabled>{{ carregandoEstados ? 'Carregando...' : 'UF' }}</option>
                      <option v-for="uf in estados" :key="uf.sigla" :value="uf.sigla">{{ uf.sigla }}</option>
                    </select>
                  </div>
                  <div class="col-md-8">
                    <label class="form-label small fw-bold">Cidade *</label>
                    <select v-model="cidadeSelecionada" class="form-select" :disabled="!estadoSelecionado || carregandoCidades">
                      <option value="" disabled>{{ carregandoCidades ? 'Carregando...' : 'Selecione a cidade' }}</option>
                      <option v-for="cidade in cidades" :key="cidade.id" :value="cidade.nome">{{ cidade.nome }}</option>
                    </select>
                  </div>
                  <div class="col-12">
                    <label class="form-label small fw-bold">Endereço completo *</label>
                    <input v-model="form.endereco" class="form-control" placeholder="Rua, número, bairro">
                  </div>

                  <div class="col-12">
                    <div class="gt-card p-3 d-flex flex-column gap-3">
                      <div class="d-flex align-items-center justify-content-between gap-3">
                        <div>
                          <label for="guia" class="fw-bold mb-0">Habilitar como guia</label>
                          <p class="text-muted small mb-0">Permite vincular este cadastro como guia responsável.</p>
                        </div>
                        <div class="form-check form-switch m-0">
                          <input id="guia" v-model="form.isGuia" type="checkbox" class="form-check-input fs-4 m-0">
                        </div>
                      </div>
                      <div class="admin-skip-validation-card">
                        <div>
                          <label for="salvarSemValidacao" class="fw-bold mb-0">Salvar sem campos necessários</label>
                          <p class="text-muted small mb-0">Permite salvar cadastro incompleto quando necessário.</p>
                        </div>
                        <div class="form-check form-switch m-0">
                          <input id="salvarSemValidacao" v-model="form.salvarSemValidacao" type="checkbox" class="form-check-input fs-4 m-0">
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="col-12">
              <div class="gt-card p-3 p-md-4">
                <div class="d-flex justify-content-between flex-wrap gap-2 mb-3">
                  <div>
                    <h6 class="fw-bold mb-1">Parentes / familiares</h6>
                    <p class="text-muted small mb-0">O vínculo aparece nos dois perfis: no seu e no da pessoa vinculada.</p>
                  </div>
                </div>

                <div class="d-flex flex-wrap gap-2 mb-3">
                  <span v-for="p in form.parentesSelecionados" :key="p.id" class="badge-gt bg-brand-soft text-brand border d-inline-flex align-items-center gap-2">
                    {{ p.nome }}
                    <button type="button" class="btn btn-sm p-0 text-danger border-0" @click="removerParente(p.id)">×</button>
                  </span>
                  <span v-if="form.parentesSelecionados.length === 0" class="text-muted small">Nenhum familiar vinculado.</span>
                </div>

                <input v-model="buscaParente" class="form-control" placeholder="Buscar passageiro para vincular...">
                <div v-if="buscaParente" class="search-popover mt-2">
                  <button v-for="u in usuariosParaVincular" :key="u.id" type="button" class="search-row" @click="adicionarParente(u)">
                    <span><strong>{{ u.nome }}</strong><small>CPF: {{ u.cpf || '-' }}</small></span>
                    <span class="gt-btn gt-btn-outline py-1 px-2">Vincular</span>
                  </button>
                  <div v-if="usuariosParaVincular.length === 0" class="p-3 small text-muted">Nenhum passageiro encontrado.</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer bg-white d-flex gap-2">
          <button class="gt-btn gt-btn-outline" @click="$emit('close')">Cancelar</button>
          <button class="gt-btn gt-btn-primary" :disabled="carregando" @click="salvar">
            {{ carregando ? 'Salvando...' : 'Salvar cadastro' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="modalOutroOrgao" class="modal fade show d-block gt-modal-backdrop" style="z-index: 1080;">
      <div class="modal-dialog modal-dialog-centered px-3">
        <div class="modal-content border-0 shadow-large">
          <div class="modal-body p-4 text-center">
            <h5 class="fw-bold mb-3">Informe o órgão expeditor</h5>
            <input v-model="outroOrgaoTexto" class="form-control text-center mb-3" placeholder="Ex: SJS, Cartório Civil" @keyup.enter="confirmarOutroOrgao">
            <div class="d-flex gap-2 justify-content-end">
              <button class="gt-btn gt-btn-outline flex-fill" @click="cancelarOutroOrgao">Cancelar</button>
              <button class="gt-btn gt-btn-primary flex-fill" @click="confirmarOutroOrgao">Confirmar</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import * as z from 'zod'
import { mascaraCPF, mascaraData, mascaraCelular, validarCPF } from '~/utils/formatadores'

const props = defineProps<{ usuarioEditando?: any; todosUsuarios: any[] }>()
const emit = defineEmits(['close', 'salvo'])
const { showToast } = useToasts()

const erro = ref('')
const carregando = ref(false)
const buscaParente = ref('')
const form = ref({
  id: null as number | null,
  nome: '',
  email: '',
  cpf: '',
  rg: '',
  orgaoExpeditor: '',
  nascimento: '',
  idade: '',
  celular: '',
  cidade: '',
  endereco: '',
  isGuia: false,
  salvarSemValidacao: false,
  parentesSelecionados: [] as any[]
})

const opcoesOrgao = ref(['DETRAN', 'DIC', 'IFP', 'SSP', 'Outros'])
const selecaoOrgao = ref('')
const modalOutroOrgao = ref(false)
const outroOrgaoTexto = ref('')
const estados = ref<Array<{ sigla: string; nome: string }>>([])
const cidades = ref<Array<{ id: number; nome: string }>>([])
const estadoSelecionado = ref('')
const cidadeSelecionada = ref('')
const carregandoEstados = ref(false)
const carregandoCidades = ref(false)

const schema = z.object({
  nome: z.string().trim().min(2, 'Nome completo é obrigatório.'),
  email: z.string().trim().email('E-mail inválido.'),
  cpf: z.string().refine((v) => validarCPF(v), 'CPF inválido.'),
  orgaoExpeditor: z.string().trim().min(1, 'Órgão expeditor é obrigatório.'),
  nascimento: z.string().trim().min(10, 'Nascimento é obrigatório.'),
  idade: z.preprocess((v) => (v === '' || v === null || v === undefined ? undefined : Number(v)), z.number({ error: 'Idade é obrigatória.' }).min(0, 'Idade inválida.')),
  celular: z.string().trim().min(14, 'Celular é obrigatório.'),
  estado: z.string().trim().min(2, 'Estado é obrigatório.'),
  cidadeSelecionada: z.string().trim().min(1, 'Cidade é obrigatória.'),
  endereco: z.string().trim().min(3, 'Endereço é obrigatório.')
})

onMounted(async () => {
  await carregarEstados()
  if (props.usuarioEditando) {
    form.value = {
      ...form.value,
      ...JSON.parse(JSON.stringify(props.usuarioEditando)),
      idade: props.usuarioEditando.idade ?? '',
      celular: mascaraCelular(String(props.usuarioEditando.celular || '')),
      parentesSelecionados: [...(props.usuarioEditando.parentes || [])]
    }

    if (props.usuarioEditando.orgaoExpeditor) {
      if (!opcoesOrgao.value.includes(props.usuarioEditando.orgaoExpeditor)) {
        opcoesOrgao.value.splice(opcoesOrgao.value.length - 1, 0, props.usuarioEditando.orgaoExpeditor)
      }
      selecaoOrgao.value = props.usuarioEditando.orgaoExpeditor
    }

    if (props.usuarioEditando.cidade?.includes(', ')) {
      const [cid, uf] = props.usuarioEditando.cidade.split(', ')
      estadoSelecionado.value = uf
      await buscarCidades(false)
      cidadeSelecionada.value = cid
    }
  }
})

const carregarEstados = async () => {
  carregandoEstados.value = true
  try {
    const res = await $fetch<any[]>('https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome')
    estados.value = res.map((e) => ({ sigla: e.sigla, nome: e.nome }))
  } catch {
    showToast('Não foi possível carregar os estados do IBGE.', 'warning')
  } finally {
    carregandoEstados.value = false
  }
}

const buscarCidades = async (limpar = true) => {
  if (limpar) cidadeSelecionada.value = ''
  cidades.value = []
  if (!estadoSelecionado.value) return
  carregandoCidades.value = true
  try {
    const res = await $fetch<any[]>(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${estadoSelecionado.value}/municipios?orderBy=nome`)
    cidades.value = res.map((c) => ({ id: c.id, nome: c.nome }))
  } catch {
    showToast('Não foi possível carregar as cidades do IBGE.', 'warning')
  } finally {
    carregandoCidades.value = false
  }
}

const handleOrgaoChange = () => {
  if (selecaoOrgao.value === 'Outros') {
    modalOutroOrgao.value = true
    outroOrgaoTexto.value = ''
    return
  }
  form.value.orgaoExpeditor = selecaoOrgao.value
}

const confirmarOutroOrgao = () => {
  const novo = outroOrgaoTexto.value.trim().toUpperCase()
  if (!novo) return
  if (!opcoesOrgao.value.includes(novo)) opcoesOrgao.value.splice(opcoesOrgao.value.length - 1, 0, novo)
  selecaoOrgao.value = novo
  form.value.orgaoExpeditor = novo
  modalOutroOrgao.value = false
}

const cancelarOutroOrgao = () => {
  selecaoOrgao.value = form.value.orgaoExpeditor || ''
  modalOutroOrgao.value = false
}

const usuariosParaVincular = computed(() => {
  const termo = buscaParente.value.toLowerCase().trim()
  if (!termo) return []
  const selecionados = new Set(form.value.parentesSelecionados.map((p) => Number(p.id)))
  if (form.value.id) selecionados.add(Number(form.value.id))
  return props.todosUsuarios.filter((u) => !selecionados.has(Number(u.id)) && (u.nome.toLowerCase().includes(termo) || String(u.cpf || '').includes(termo))).slice(0, 8)
})
const adicionarParente = (u: any) => { form.value.parentesSelecionados.push(u); buscaParente.value = '' }
const removerParente = (id: number) => { form.value.parentesSelecionados = form.value.parentesSelecionados.filter((p) => p.id !== id) }

const salvar = async () => {
  erro.value = ''
  if (cidadeSelecionada.value && estadoSelecionado.value) form.value.cidade = `${cidadeSelecionada.value}, ${estadoSelecionado.value}`

  if (!form.value.salvarSemValidacao) {
    const result = schema.safeParse({
      ...form.value,
      estado: estadoSelecionado.value,
      cidadeSelecionada: cidadeSelecionada.value
    })
    if (!result.success) {
      erro.value = result.error.issues[0]?.message || 'Verifique os dados obrigatórios.'
      showToast(erro.value, 'warning')
      return
    }
  } else if (!String(form.value.nome || '').trim()) {
    erro.value = 'Informe pelo menos o nome para salvar sem validação.'
    showToast(erro.value, 'warning')
    return
  }

  carregando.value = true
  try {
    const payload = {
      ...form.value,
      celular: mascaraCelular(form.value.celular),
      idade: form.value.idade === '' ? null : Number(form.value.idade),
      skipValidation: Boolean(form.value.salvarSemValidacao),
      parentesIds: form.value.parentesSelecionados.map((p) => p.id)
    }
    const method = form.value.id ? 'PUT' : 'POST'
    const url = form.value.id ? `/api/users/${form.value.id}` : '/api/users'
    await $fetch(url, { method, body: payload })
    showToast('Passageiro salvo com sucesso.', 'success')
    emit('salvo')
    emit('close')
  } catch (e: any) {
    erro.value = e.data?.statusMessage || 'Erro ao salvar cadastro.'
    showToast(erro.value, 'danger')
  } finally {
    carregando.value = false
  }
}
</script>
