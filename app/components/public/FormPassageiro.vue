<template>
  <div class="gt-card p-4 p-md-5 public-form-card">
    <div v-if="erro" class="alert alert-danger rounded-gt border-0 fw-semibold small">{{ erro }}</div>

    <div class="row g-3">
      <div class="col-12">
        <label class="form-label small fw-bold">Nome completo *</label>
        <input v-model="form.nome" class="form-control py-3" placeholder="Seu nome completo">
      </div>

      <div class="col-md-6">
        <label class="form-label small fw-bold">E-mail *</label>
        <input v-model="form.email" type="email" class="form-control py-3" placeholder="email@exemplo.com">
      </div>

      <div class="col-md-6">
        <label class="form-label small fw-bold">CPF *</label>
        <input :value="form.cpf" maxlength="14" class="form-control py-3" placeholder="000.000.000-00" @input="e => form.cpf = mascaraCPF((e.target as HTMLInputElement).value)">
      </div>

      <div class="col-md-4">
        <label class="form-label small fw-bold">Nascimento *</label>
        <input :value="form.nascimento" maxlength="10" class="form-control py-3" placeholder="DD/MM/AAAA" @input="e => form.nascimento = mascaraData((e.target as HTMLInputElement).value)">
      </div>

      <div class="col-md-4">
        <label class="form-label small fw-bold">Idade *</label>
        <input v-model="form.idade" type="number" min="0" class="form-control py-3" placeholder="Ex: 18">
      </div>

      <div class="col-md-4">
        <label class="form-label small fw-bold">RG</label>
        <input v-model="form.rg" class="form-control py-3" placeholder="Opcional">
      </div>

      <div class="col-md-6">
        <label class="form-label small fw-bold">Órgão expeditor *</label>
        <select v-model="selecaoOrgao" class="form-select py-3" @change="handleOrgaoChange">
          <option value="" disabled>Selecione...</option>
          <option v-for="op in opcoesOrgao" :key="op" :value="op">{{ op }}</option>
        </select>
      </div>

      <div class="col-md-6">
        <label class="form-label small fw-bold">Celular / WhatsApp *</label>
        <input :value="form.celular" maxlength="15" class="form-control py-3" placeholder="(22) 99999-9999" @input="e => form.celular = mascaraCelular((e.target as HTMLInputElement).value)">
      </div>

      <div class="col-md-4">
        <label class="form-label small fw-bold">Estado *</label>
        <select v-model="estadoSelecionado" class="form-select py-3" :disabled="carregandoEstados" @change="buscarCidades()">
          <option value="" disabled>{{ carregandoEstados ? 'Carregando...' : 'UF' }}</option>
          <option v-for="uf in estados" :key="uf.sigla" :value="uf.sigla">{{ uf.sigla }}</option>
        </select>
      </div>

      <div class="col-md-8">
        <label class="form-label small fw-bold">Cidade *</label>
        <select v-model="cidadeSelecionada" class="form-select py-3" :disabled="!estadoSelecionado || carregandoCidades">
          <option value="" disabled>{{ carregandoCidades ? 'Carregando cidades...' : 'Selecione a cidade' }}</option>
          <option v-for="cidade in cidades" :key="cidade.id" :value="cidade.nome">{{ cidade.nome }}</option>
        </select>
      </div>

      <div class="col-12">
        <label class="form-label small fw-bold">Endereço completo *</label>
        <input v-model="form.endereco" class="form-control py-3" placeholder="Rua, número, bairro">
      </div>

      <div class="col-12 pt-2">
        <button class="gt-btn gt-btn-primary w-100 py-3" :disabled="carregando" @click="salvar">
          {{ carregando ? 'Salvando...' : (form.id ? 'Salvar alterações' : 'Realizar cadastro') }}
        </button>
      </div>
      <div v-if="mostrarAtalhoLogin" class="col-12 pt-0">
        <button class="gt-btn gt-btn-outline public-form-login-shortcut w-100" @click="$emit('acessarViagem')">
          Já tem cadastro? Acessar minha viagem
        </button>
      </div>
    </div>

    <div v-if="modalOutroOrgao" class="modal fade show d-block gt-modal-backdrop" style="z-index: 1080;">
      <div class="modal-dialog modal-dialog-centered px-3">
        <div class="modal-content border-0 shadow-large">
          <div class="modal-body p-4 text-center">
            <h5 class="fw-bold mb-3">Informe o órgão expeditor</h5>
            <input v-model="outroOrgaoTexto" class="form-control text-center mb-3" placeholder="Ex: SJS, Cartório Civil" @keyup.enter="confirmarOutroOrgao">
            <div class="d-flex gap-2">
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

const props = defineProps<{ cpfFamiliar?: string; usuarioEditando?: any }>()
const emit = defineEmits(['sucesso', 'acessarViagem'])
const erro = ref('')
const carregando = ref(false)
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
  cpfFamiliar: props.cpfFamiliar || ''
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
const mostrarAtalhoLogin = computed(() => !form.value.id && !props.cpfFamiliar)

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
    form.value = { ...form.value, ...JSON.parse(JSON.stringify(props.usuarioEditando)), idade: props.usuarioEditando.idade ?? '', celular: mascaraCelular(String(props.usuarioEditando.celular || '')) }

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

watch(() => props.cpfFamiliar, (cpf) => { form.value.cpfFamiliar = cpf || '' })

const carregarEstados = async () => {
  carregandoEstados.value = true
  try {
    const res = await $fetch<any[]>('https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome')
    estados.value = res.map((e) => ({ sigla: e.sigla, nome: e.nome }))
  } catch {
    erro.value = 'Não foi possível carregar os estados do IBGE.'
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
    erro.value = 'Não foi possível carregar as cidades do IBGE.'
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

const salvar = async () => {
  erro.value = ''
  if (cidadeSelecionada.value && estadoSelecionado.value) form.value.cidade = `${cidadeSelecionada.value}, ${estadoSelecionado.value}`

  const result = schema.safeParse({ ...form.value, estado: estadoSelecionado.value, cidadeSelecionada: cidadeSelecionada.value })
  if (!result.success) {
    erro.value = result.error.issues[0]?.message || 'Verifique os campos obrigatórios.'
    return
  }

  carregando.value = true
  try {
    const method = form.value.id ? 'PUT' : 'POST'
    const url = form.value.id ? `/api/users/${form.value.id}` : '/api/users'
    await $fetch(url, { method, body: { ...form.value, idade: Number(form.value.idade), celular: mascaraCelular(form.value.celular), origem: 'area-passageiro' } })
    emit('sucesso', form.value.cpf.replace(/\D/g, ''), form.value.nome)
  } catch (e: any) {
    erro.value = e.data?.statusMessage || 'Erro ao salvar cadastro.'
  } finally {
    carregando.value = false
  }
}
</script>
