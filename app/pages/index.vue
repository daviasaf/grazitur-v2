<template>
  <div class="public-shell min-vh-100">
    <UiToastManager />

    <header class="public-site-header">
      <div class="container public-header-inner">
        <button class="public-brand" @click="voltar">
          <span class="logo-icon"><UiBusIcon /></span>
          <strong>GraziTur</strong>
        </button>
        <button v-if="step !== 'home'" class="gt-btn gt-btn-outline" @click="voltar">Voltar ao início</button>
      </div>
    </header>

    <main class="container public-main">
      <section v-if="step === 'home'" class="public-home">
        <div class="gt-card public-hero-showcase">
          <div class="public-hero-content">
                        <h1>Viajar em grupo com cuidado, organização e carinho.</h1>
            <p>A GraziTur organiza excursões, acompanha os passageiros e facilita contratos, familiares e pagamentos em um só lugar.</p>

            <div class="public-actions-grid">
              <button class="public-action-card" @click="step = 'cadastro'">
                <span class="public-action-icon"><svg viewBox="0 0 24 24"><path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z"/><path d="M4 21a8 8 0 0 1 16 0"/><path d="M19 8h3"/><path d="M20.5 6.5v3"/></svg></span>
                <span>
                  <strong>Novo cadastro</strong>
                  <small>Cadastrar passageiro ou familiar.</small>
                </span>
              </button>

              <button class="public-action-card" @click="step = 'login'">
                <span class="public-action-icon"><svg viewBox="0 0 24 24"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="m10 17 5-5-5-5"/><path d="M15 12H3"/></svg></span>
                <span>
                  <strong>Acessar minha viagem</strong>
                  <small>Ver contratos, PIX e familiares.</small>
                </span>
              </button>
            </div>
          </div>

          <div class="public-hero-visual">
            <img src="/grazi-turismo.png" alt="Grazi Turismo em frente ao ônibus">
          </div>
        </div>

        <div class="gt-card places-panel places-panel-pro">
          <div class="places-heading-pro">
            <div>
                            <h2>Lugares já viajados</h2>
              <p>Alguns destinos que já fizeram parte da rota da GraziTur.</p>
            </div>
          </div>
          <div class="places-list-pro">
            <div v-for="(lugar, index) in lugaresViajados" :key="lugar" class="place-item-pro">
              <span>{{ String(index + 1).padStart(2, '0') }}</span>
              <strong>{{ lugar }}</strong>
            </div>
          </div>
        </div>
      </section>

      <section v-else class="public-flow" :class="{
        'public-flow-passenger': step === 'login',
        'public-flow-form': step === 'cadastro',
        'public-flow-success': step === 'sucesso'
      }">
        <PublicAreaPassageiro v-if="step === 'login'" @editarDados="editarDados" @cadastrarFamiliar="cadastrarFamiliar" />

        <div v-if="step === 'cadastro'" class="public-form-wrap">
          <div class="flow-heading">
            <h1>{{ usuarioEditando ? 'Editar meus dados' : cpfFamiliar ? 'Cadastrar familiar' : 'Cadastro de passageiro' }}</h1>
            <p>Preencha os dados para manter seu cadastro atualizado.</p>
          </div>
          <PublicFormPassageiro
            :cpfFamiliar="cpfFamiliar"
            :usuarioEditando="usuarioEditando"
            @sucesso="sucesso"
            @acessarViagem="step = 'login'"
          />
        </div>

        <div v-if="step === 'sucesso'" class="gt-card success-panel">
          <span class="success-ring"><svg viewBox="0 0 24 24"><path d="m5 13 4 4L19 7" /></svg></span>
          <h2>Cadastro salvo!</h2>
          <p>Os dados foram registrados com sucesso.</p>
          <div class="success-actions">
            <button class="gt-btn gt-btn-primary" @click="voltar">Concluir</button>
            <button v-if="cpfTitularCadastro" class="gt-btn gt-btn-outline" @click="adicionarParenteDepois">Adicionar parente/amigo</button>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
const step = ref<'home' | 'cadastro' | 'login' | 'sucesso'>('home')
const cpfFamiliar = ref('')
const cpfTitularCadastro = ref('')
const usuarioEditando = ref<any>(null)
const lugaresViajados = [
  'Bio Parque',
  'Arraial do Cabo',
  'Guapi Parque das Águas',
  'Jonosake',
  'Petrópolis (Itaipava)',
  'Vitória / Vila Velha',
  'Terra do Dino',
  'Campos do Jordão',
  'Porto Seguro',
  'Penedo',
  'Aparecida',
  'Aracruz',
  'Rio de Janeiro (Cristo Redentor)'
]
const voltar = () => { step.value = 'home'; cpfFamiliar.value = ''; cpfTitularCadastro.value = ''; usuarioEditando.value = null }
const sucesso = (cpfSalvo?: string) => { if (!usuarioEditando.value && !cpfFamiliar.value && cpfSalvo) cpfTitularCadastro.value = String(cpfSalvo).replace(/\D/g, ''); step.value = 'sucesso'; cpfFamiliar.value = ''; usuarioEditando.value = null }
const adicionarParenteDepois = () => { cpfFamiliar.value = cpfTitularCadastro.value; usuarioEditando.value = null; step.value = 'cadastro' }
const editarDados = (u: any) => { usuarioEditando.value = u; cpfFamiliar.value = ''; step.value = 'cadastro' }
const cadastrarFamiliar = (u: any) => { usuarioEditando.value = null; cpfFamiliar.value = u.cpf; step.value = 'cadastro' }
</script>
