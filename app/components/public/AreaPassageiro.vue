<template>
  <div>
    <section v-if="!usuario" class="passenger-login-section">
      <div class="gt-card passenger-login-card">
        <div class="login-mark"><UiBusIcon /></div>
        <h1>Acessar minha viagem</h1>
        <p>Informe CPF e data de nascimento para consultar suas viagens.</p>

        <div class="login-form-box">
          <label class="form-label">CPF do passageiro</label>
          <input
            :value="cpf"
            maxlength="14"
            class="form-control auth-input"
            placeholder="000.000.000-00"
            inputmode="numeric"
            @input="e => cpf = mascaraCPF((e.target as HTMLInputElement).value)"
            @keyup.enter="entrar"
          >
          <label class="form-label mt-3">Data de nascimento</label>
          <input
            :value="nascimento"
            maxlength="10"
            class="form-control auth-input"
            placeholder="DD/MM/AAAA"
            inputmode="numeric"
            autocomplete="bday"
            @input="e => nascimento = mascaraData((e.target as HTMLInputElement).value)"
            @keyup.enter="entrar"
          >
          <button class="gt-btn gt-btn-primary w-100" :disabled="carregando" @click="entrar">
            {{ carregando ? 'Buscando cadastro...' : 'Entrar' }}
          </button>
          <p v-if="erro" class="text-danger small fw-bold mt-3 mb-0">{{ erro }}</p>
        </div>
      </div>
    </section>

    <section v-else class="passenger-area passenger-area-pro">
      <div class="passenger-dashboard gt-card">
        <div class="passenger-dashboard-main">
          <h1>Olá, {{ primeiroNome }}!</h1>
          <p>Veja suas viagens, contratos, pagamentos por Pix e familiares vinculados.</p>
        </div>

        <div class="passenger-dashboard-actions">
          <button class="gt-btn gt-btn-primary" @click="$emit('cadastrarFamiliar', usuario)">Cadastrar familiar</button>
          <button class="gt-btn gt-btn-outline" @click="$emit('editarDados', usuario)">Editar meus dados</button>
          <button class="gt-btn gt-btn-danger" @click="sair">Sair</button>
        </div>

        <div v-if="usuario.parentes?.length" class="passenger-family-inline">
          <strong>Familiares vinculados</strong>
          <span v-for="p in usuario.parentes" :key="p.id">{{ p.nome }}</span>
        </div>
      </div>

      <div v-if="excursoes.length" class="passenger-section-header">
        <h2>Minhas viagens</h2>
        <p>Acompanhe pagamentos e contratos de cada excursão ativa.</p>
      </div>

      <div v-if="excursoes.length === 0" class="gt-card passenger-empty-simple">
        <strong>Nenhuma viagem ativa no perfil.</strong>
        <span>Quando você for vinculado a uma excursão ativa, ela aparecerá aqui.</span>
      </div>

      <div v-if="excursoes.length" class="passenger-trips-grid">
      <article v-for="ex in excursoes" :key="ex.id" class="gt-card passenger-trip-pro">
        <header class="passenger-trip-header-pro">
          <div>
            <h2>{{ ex.nome }}</h2>
            <p>{{ ex.lugar }}</p>
          </div>
        </header>

        <div class="trip-summary-line">
          <div>
            <span>Saída</span>
            <strong>{{ ex.detalhes?.dataSaida || 'A definir' }} {{ ex.detalhes?.horaSaida || '' }}</strong>
          </div>
          <div>
            <span>Retorno</span>
            <strong>{{ ex.detalhes?.dataRetorno || 'A definir' }} {{ ex.detalhes?.horaRetorno || '' }}</strong>
          </div>
          <div>
            <span>Transporte</span>
            <strong>{{ ex.detalhes?.transporte || 'A definir' }}</strong>
          </div>
        </div>

        <div class="passenger-payments-pro">
          <div v-for="p in obterLiderEDependentes(ex)" :key="p.id" class="payment-row-pro">
            <div class="payment-person-pro">
              <strong>{{ p.nome }}</strong>
              <span>{{ obterPagamento(ex, p.id) }}</span>
            </div>
            <button v-if="podePagarPix(ex, p.id)" class="gt-btn gt-btn-primary gt-btn-xs" @click="abrirModalPix(ex, p)">Pagar Pix</button>
            <span v-else-if="obterPagamento(ex, p.id) === 'Criança de 0 a 1,9 meses - Isento'" class="payment-state-pro">Isento</span>
            <span v-else-if="contratoPrecisaAssinar(ex) && !contratoAssinadoPeloResponsavel(ex)" class="payment-state-pro">Assine o contrato</span>
            <span v-else class="payment-state-pro">A combinar</span>
          </div>
        </div>

        <div class="contract-row-pro" :class="{ 'contract-row-locked': !contratoLiberado(ex) }">
          <div>
            <strong>Contrato digital</strong>
            <span>{{ textoContrato(ex) }}</span>
          </div>
          <button v-if="!contratoLiberado(ex)" class="gt-btn gt-btn-primary contract-locked-button" disabled>Contrato não liberado</button>
          <button v-else-if="verificarAssinatura(ex) && podeBaixarContrato(ex)" class="gt-btn gt-btn-outline" @click="baixarContrato(ex)">Baixar contrato</button>
          <button v-else-if="!verificarSeEhDependente(ex) && !verificarAssinatura(ex)" class="gt-btn gt-btn-primary" @click="abrirContrato(ex)">Ler e assinar</button>
        </div>
      </article>
      </div>

      <section class="passenger-open-trips">
        <div class="passenger-section-header">
          <h2>Excursões abertas</h2>
          <p>Demonstre interesse e fale com a GraziTur pelo WhatsApp.</p>
        </div>

        <div class="interest-list-pro">
          <div v-for="ex in excursoesDisponiveisFiltradas" :key="ex.id" class="gt-card interest-card-pro">
            <div>
              <h3>{{ ex.nome }}</h3>
              <p>{{ ex.lugar }}</p>
            </div>
            <div v-if="jaEstouNaEspera(ex)" class="interest-status-pro">Você já está na lista de espera.</div>
            <button v-else class="gt-btn gt-btn-outline" @click="abrirListaEspera(ex)">Entrar na lista de espera</button>
          </div>
          <div v-if="excursoesDisponiveisFiltradas.length === 0" class="gt-card passenger-empty-simple">
            <strong>Não há excursões abertas no momento.</strong>
            <span>Quando uma nova viagem estiver disponível, ela aparecerá aqui.</span>
          </div>
        </div>
      </section>
    </section>

    <div v-if="modalPixAberto" class="modal fade show d-block gt-modal-backdrop" style="z-index: 1060;">
      <div class="modal-dialog modal-dialog-centered px-3">
        <div class="modal-content border-0 shadow-large">
          <div class="modal-header border-0 pb-0"><button type="button" class="btn-close" @click="modalPixAberto = false"></button></div>
          <div class="modal-body text-center px-4 px-md-5 pb-5 pt-0">
            <div class="pix-mark">Pix</div>
            <h5 class="fw-bold mb-1">Pagamento via Pix</h5>
            <p class="small text-muted mb-4">Passageiro: <strong>{{ pixData.nome }}</strong><br>Parcela: <strong class="text-success-gt">{{ pixData.valor }}</strong></p>
            <div class="pix-code-box">{{ pixData.codigo }}</div>
            <button class="gt-btn gt-btn-primary w-100 py-3" @click="copiarPixEAvise">Copiar Pix Copia e Cola</button>
            <p class="mt-3 mb-0 small text-muted fst-italic">Depois de copiar, abra o aplicativo do banco para colar.</p>
          </div>
        </div>
      </div>
    </div>

    <div v-if="modalAvisoAberto" class="modal fade show d-block gt-modal-backdrop" style="z-index: 1070;">
      <div class="modal-dialog modal-dialog-centered px-3" style="max-width: 400px;">
        <div class="modal-content border-0 shadow-large text-center p-4 p-md-5 position-relative">
          <button type="button" class="btn-close position-absolute top-0 end-0 m-3" @click="modalAvisoAberto = false"></button>
          <span class="success-ring mx-auto mb-3"><svg viewBox="0 0 24 24"><path d="m5 13 4 4L19 7" /></svg></span>
          <h5 class="fw-bold mb-2">Código copiado!</h5>
          <p class="text-muted small fw-semibold mb-4 lh-base">Avise a GraziTur que você pagou a parcela de <br><strong class="text-brand fs-6">{{ passageiroAviso }}</strong></p>
          <a :href="linkWhatsApp" target="_blank" class="gt-btn gt-btn-success w-100 py-3" @click="modalAvisoAberto = false">Avisar pelo WhatsApp</a>
        </div>
      </div>
    </div>

    <div v-if="modalListaEsperaAberto && excursaoListaEspera" class="modal fade show d-block gt-modal-backdrop" style="z-index: 1080;">
      <div class="modal-dialog modal-dialog-centered px-3">
        <div class="modal-content border-0 shadow-large">
          <div class="modal-header border-0">
            <div><h5 class="fw-bold mb-1">Entrar na lista de espera</h5><p class="text-muted small mb-0">Escolha quem deseja incluir na mensagem para a GraziTur.</p></div>
            <button type="button" class="btn-close" @click="modalListaEsperaAberto = false"></button>
          </div>
          <div class="modal-body pt-0 waitlist-choice-body">
            <button class="waitlist-choice-main" @click="enviarListaEspera(false)">
              <strong>Somente eu</strong>
              <span>Envia somente seu nome no WhatsApp.</span>
            </button>
            <div v-if="parentesListaEspera.length" class="waitlist-family-box">
              <strong>Adicionar parentes</strong>
              <div v-for="p in parentesListaEspera" :key="p.id" class="form-check py-2">
                <input :id="`espera-${p.id}`" v-model="parentesSelecionadosEspera" class="form-check-input" type="checkbox" :value="String(p.id)">
                <label :for="`espera-${p.id}`" class="form-check-label">{{ p.nome }}</label>
              </div>
              <button class="gt-btn gt-btn-primary w-100 mt-3" :disabled="parentesSelecionadosEspera.length === 0" @click="enviarListaEspera(true)">Enviar com parentes</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="modalContrato && excursaoContrato" class="modal fade show d-block gt-modal-backdrop" style="z-index: 1090;">
      <div class="modal-dialog modal-xl modal-dialog-scrollable px-2">
        <div class="modal-content border-0 shadow-large">
          <div class="modal-header gt-modal-header">
            <div><h5 class="fw-bold mb-0">Contrato de Aquisição de Pacote de Turismo</h5><p class="text-muted small mb-0">Leia com atenção antes de assinar.</p></div>
            <button class="btn-close" @click="modalContrato = false"></button>
          </div>
          <div class="modal-body p-0 contract-modal-body">
            <div class="contract-reader" v-html="contratoHtml"></div>
            <div class="contract-accept-bar">
              <div class="form-check m-0">
                <input id="aceiteContrato" v-model="aceito" class="form-check-input" type="checkbox">
                <label for="aceiteContrato" class="form-check-label fw-bold">Li o contrato inteiro e estou de acordo.</label>
              </div>
            </div>
          </div>
          <div class="modal-footer"><button class="gt-btn gt-btn-outline" @click="modalContrato = false">Cancelar</button><button class="gt-btn gt-btn-primary" :disabled="!aceito || assinando" @click="assinar">{{ assinando ? 'Registrando assinatura...' : 'Assinar contrato digitalmente' }}</button></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { mascaraCPF, mascaraData } from '~/utils/formatadores'
import { gerarContratoHtml, gerarContratoAssinadoPDF } from '~/utils/exportacoes'

defineEmits(['editarDados', 'cadastrarFamiliar'])
const { showToast } = useToasts()
const cpf = ref('')
const nascimento = ref('')
const usuario = ref<any>(null)
const excursoes = ref<any[]>([])
const excursoesDisponiveis = ref<any[]>([])
const erro = ref('')
const carregando = ref(false)
const modalContrato = ref(false)
const excursaoContrato = ref<any>(null)
const aceito = ref(false)
const assinando = ref(false)
const modalPixAberto = ref(false)
const modalAvisoAberto = ref(false)
const modalListaEsperaAberto = ref(false)
const excursaoListaEspera = ref<any>(null)
const parentesSelecionadosEspera = ref<string[]>([])
const pixData = ref({ exId: null as number | null, userId: null as number | null, nome: '', valor: '', codigo: '', nomeViagem: '' })
const passageiroAviso = ref('')
const primeiroNome = computed(() => usuario.value?.nome?.split(' ')[0] || '')
const parentesListaEspera = computed(() => usuario.value?.parentes || [])
const contratoHtml = computed(() => {
  if (!excursaoContrato.value || !usuario.value) return ''
  const liderId = liderResponsavelId(excursaoContrato.value)
  const lider = (excursaoContrato.value.usuarios || []).find((u: any) => String(u.id) === String(liderId)) || usuario.value
  return gerarContratoHtml(excursaoContrato.value, lider)
})

const parseJson = <T,>(v: any, fallback: T): T => { if (!v) return fallback; if (typeof v !== 'string') return v; try { return JSON.parse(v) } catch { return fallback } }
const formatarExcursao = (ex: any) => ({ ...ex, valores: parseJson(ex.valores, []), pagamentos: parseJson(ex.pagamentosJson, {}), detalhes: parseJson(ex.contratoDetalhes, {}), grupos: parseJson(ex.contratoGrupos, {}), assinaturas: parseJson(ex.assinaturasJson, {}), despesas: parseJson(ex.despesasJson, []), listaEspera: parseJson(ex.listaEsperaJson, []) })
const excursoesDisponiveisFiltradas = computed(() => { const idsMinhas = new Set(excursoes.value.map((ex) => String(ex.id))); return excursoesDisponiveis.value.filter((ex) => !ex.finalizada && ex.mostrarAberta !== false && !idsMinhas.has(String(ex.id))) })
const jaEstouNaEspera = (ex: any) => Boolean(ex.onWaitlist)
const linkWhatsApp = computed(() => { const nomeViagem = pixData.value.nomeViagem || 'a excursão'; const msg = `Olá, acabei de pagar a taxa da viagem ${nomeViagem} no valor de ${pixData.value.valor}, pelo passageiro ${pixData.value.nome}`; return `https://wa.me/5522999454860?text=${encodeURIComponent(msg)}` })

onMounted(async () => {
  try {
    const res = await $fetch<any>('/api/passageiro/viagens')
    usuario.value = res.user
    excursoes.value = res.excursoes
    await carregarDisponiveis()
  } catch {}
})
const carregarDisponiveis = async () => { try { const res = await $fetch<any[]>('/api/excursoes?finalizada=false&publico=true'); excursoesDisponiveis.value = res.map(formatarExcursao) } catch {} }
const entrar = async () => { erro.value = ''; carregando.value = true; try { const res = await $fetch<any>('/api/passageiro/viagens', { method: 'POST', body: { cpf: cpf.value, nascimento: nascimento.value } }); usuario.value = res.user; excursoes.value = res.excursoes; await carregarDisponiveis() } catch (e: any) { erro.value = e.data?.statusMessage || 'Dados não conferem.' } finally { carregando.value = false } }
const sair = async () => { await $fetch('/api/passageiro/viagens', { method: 'DELETE' }).catch(() => null); usuario.value = null; excursoes.value = []; excursoesDisponiveis.value = []; cpf.value = ''; nascimento.value = '' }

const abrirListaEspera = (ex: any) => { if (!usuario.value) return; excursaoListaEspera.value = ex; parentesSelecionadosEspera.value = []; modalListaEsperaAberto.value = true }
const textoListaEspera = (ex: any, incluirParentes: boolean, parentes: any[] = []) => { const base = [`Olá, Grazi! Tudo bem?`, '', `Tenho interesse na viagem ${ex.nome}.`, `Meu nome é ${usuario.value.nome}.`, 'Estou na lista de espera.']; if (!incluirParentes || !parentes.length) return base.join('\n'); return [...base, '', 'Gostaria de colocar estes parentes também na lista de espera:', ...parentes.map((p: any) => `- ${p.nome}`)].join('\n') }
const enviarListaEspera = async (incluirParentes: boolean) => { const ex = excursaoListaEspera.value; if (!usuario.value || !ex) return; const parentes = (usuario.value?.parentes || []).filter((p: any) => parentesSelecionadosEspera.value.includes(String(p.id))); try { await $fetch(`/api/excursoes/${ex.id}/espera`, { method: 'POST', body: { userId: usuario.value.id, origem: 'Área do passageiro' } }); if (incluirParentes) for (const parente of parentes) await $fetch(`/api/excursoes/${ex.id}/espera`, { method: 'POST', body: { userId: parente.id, origem: 'Área do passageiro - parentes' } }); await carregarDisponiveis(); showToast('Lista de espera atualizada com sucesso.', 'success') } catch (e: any) { showToast(e.data?.statusMessage || 'Não foi possível entrar na lista de espera.', 'warning') } modalListaEsperaAberto.value = false; const msg = textoListaEspera(ex, incluirParentes, parentes); window.open(`https://wa.me/5522999454860?text=${encodeURIComponent(msg)}`, '_blank') }

const obterPagamento = (ex: any, pId: number) => ex.pagamentos?.[String(pId)] || 'Pendente / À combinar'
const obterDependentes = (ex: any) => { if (!ex || !usuario.value) return []; const idsDependentes = ex.grupos?.[String(usuario.value.id)] || []; return ex.usuarios.filter((u: any) => idsDependentes.map(String).includes(String(u.id))) }
const obterLiderEDependentes = (ex: any) => { if (!usuario.value) return []; return [usuario.value, ...obterDependentes(ex)] }
const verificarSeEhDependente = (ex: any) => { if (!ex || !ex.grupos || !usuario.value) return false; return Object.values(ex.grupos).some((dependentesArray: any) => dependentesArray.map(String).includes(String(usuario.value.id))) }
const verificarAssinatura = (ex: any) => { if (!ex?.assinaturas || !usuario.value) return false; return !!ex.assinaturas[String(usuario.value.id)] }
const contratoLiberado = (ex: any) => Boolean(ex.ativarContrato && ex.liberarContratos)
const textoContrato = (ex: any) => {
  if (!contratoLiberado(ex)) return 'GraziTur ainda não liberou a assinatura desta viagem.'
  if (verificarAssinatura(ex)) return 'Contrato assinado e disponível para baixar.'
  if (verificarSeEhDependente(ex)) return 'Você está como dependente. O titular assina o contrato.'
  return 'Leia e assine para liberar o pagamento.'
}
const podeBaixarContrato = (ex: any) => { const liderId = liderResponsavelId(ex); return Boolean(liderId && ex?.assinaturas?.[String(liderId)] && ex?.assinaturas?.[`admin_${liderId}`]) }
const baixarContrato = (ex: any) => { const liderId = liderResponsavelId(ex); if (!liderId) return; gerarContratoAssinadoPDF(ex, liderId, showToast) }
const abrirContrato = (ex: any) => { excursaoContrato.value = ex; aceito.value = false; modalContrato.value = true }
const assinar = async () => { assinando.value = true; try { const res = await $fetch<any>('/api/passageiro/assinar', { method: 'POST', body: { userId: usuario.value.id, excursaoId: excursaoContrato.value.id } }); if (!excursaoContrato.value.assinaturas) excursaoContrato.value.assinaturas = {}; excursaoContrato.value.assinaturas = res.assinaturas || { ...excursaoContrato.value.assinaturas, [String(usuario.value.id)]: new Date().toISOString() }; modalContrato.value = false; showToast('Contrato assinado com sucesso.', 'success') } catch (e: any) { showToast(e.data?.statusMessage || 'Erro ao assinar contrato. Verifique a conexão com o banco de dados.', 'danger') } finally { assinando.value = false } }
const contratoPrecisaAssinar = (ex: any) => Boolean(ex.ativarContrato && ex.liberarContratos)
const liderResponsavelId = (ex: any) => { if (!usuario.value) return null; for (const [liderId, dependentes] of Object.entries(ex.grupos || {})) { if ((dependentes as any[]).map(String).includes(String(usuario.value.id))) return String(liderId) } return String(usuario.value.id) }
const contratoAssinadoPeloResponsavel = (ex: any) => { if (!contratoPrecisaAssinar(ex)) return true; const liderId = liderResponsavelId(ex); return Boolean(liderId && ex.assinaturas?.[String(liderId)]) }
const podePagarPix = (ex: any, userId: number) => { const pag = obterPagamento(ex, userId); if (!contratoPrecisaAssinar(ex) || !contratoAssinadoPeloResponsavel(ex)) return false; return pag !== 'Pendente / À combinar' && pag !== 'Pendente' && pag !== 'Criança de 0 a 1,9 meses - Isento' }
const obterValorParcela = (pagamentoStr: string) => { if (!pagamentoStr || pagamentoStr === 'Pendente / À combinar') return ''; const match = pagamentoStr.match(/R\$\s*([\d,.]+)/); return match ? `R$ ${match[1]}` : pagamentoStr }
const gerarPixCopiaECola = (ex: any, userId: number) => { const chavePix = '58904532000133'; const valorStr = obterValorParcela(obterPagamento(ex, userId)).replace('R$ ', '').replace(/\./g, '').replace(',', '.'); const valor = parseFloat(valorStr) || 0; const valorFormatado = valor.toFixed(2); const tamanhoValor = valorFormatado.length.toString().padStart(2, '0'); const payload = `00020126360014BR.GOV.BCB.PIX0114${chavePix}52040000530398654${tamanhoValor}${valorFormatado}5802BR5901N6001C62160512GraziTurismo6304`; let crc = 0xffff; for (let i = 0; i < payload.length; i++) { crc ^= payload.charCodeAt(i) << 8; for (let j = 0; j < 8; j++) crc = (crc & 0x8000) > 0 ? (crc << 1) ^ 0x1021 : crc << 1 } const crcHex = (crc & 0xffff).toString(16).toUpperCase().padStart(4, '0'); return payload + crcHex }
const abrirModalPix = (ex: any, user: any) => { const valor = obterValorParcela(obterPagamento(ex, user.id)); const codigo = gerarPixCopiaECola(ex, user.id); pixData.value = { exId: ex.id, userId: user.id, nome: user.nome, valor, codigo, nomeViagem: ex.nome }; modalPixAberto.value = true }
const copiarPixEAvise = async () => {
  try {
    await navigator.clipboard.writeText(pixData.value.codigo)
    showToast('Pix copiado.', 'success')
  } catch {
    showToast('Não foi possível copiar automaticamente. Copie manualmente.', 'warning')
  }
  passageiroAviso.value = pixData.value.nome
  modalPixAberto.value = false
  modalAvisoAberto.value = true
}
</script>
