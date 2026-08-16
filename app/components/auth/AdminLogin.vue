<template>
  <div class="admin-login-shell min-vh-100">
    <div class="admin-login-split gt-card">
      <section class="login-copy-panel">
        <h1>Gestão profissional das viagens GraziTur.</h1>
        <p>Controle excursões, passageiros, contratos, pagamentos e relatórios em um painel organizado e seguro.</p>
        <div class="login-feature-grid">
          <span>Excursões</span>
          <span>Contratos</span>
          <span>Financeiro</span>
          <span>Passageiros</span>
        </div>
      </section>

      <section class="login-form-panel">
        <div class="mb-4">
          <h2>Entrar no painel</h2>
          <p>Acesse com as credenciais administrativas.</p>
        </div>

        <label class="form-label">E-mail</label>
        <input v-model="email" type="email" class="form-control" placeholder="Digite seu e-mail" autocomplete="off" @keyup.enter="fazerLogin">

        <label class="form-label mt-3">Senha</label>
        <div class="password-field">
          <input v-model="password" :type="mostrarSenha ? 'text' : 'password'" class="form-control" placeholder="Digite sua senha" autocomplete="current-password" @keyup.enter="fazerLogin">
          <button
            type="button"
            class="password-toggle-btn"
            :title="mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'"
            :aria-label="mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'"
            :aria-pressed="mostrarSenha"
            @click="mostrarSenha = !mostrarSenha"
          >
            <svg v-if="!mostrarSenha" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <svg v-else viewBox="0 0 24 24" aria-hidden="true">
              <path d="m3 3 18 18" />
              <path d="M10.6 10.6a3 3 0 0 0 3.8 3.8" />
              <path d="M7.1 7.5C4.2 9.2 2.5 12 2.5 12s3.5 6 9.5 6c1.7 0 3.1-.4 4.4-1.1" />
              <path d="M14.2 6.3C18.8 7.4 21.5 12 21.5 12s-.8 1.4-2.2 2.8" />
            </svg>
          </button>
        </div>

        <p v-if="erro" class="text-danger small fw-bold mt-3 mb-0">{{ erro }}</p>
        <button class="gt-btn gt-btn-primary w-100 mt-4" @click="fazerLogin" :disabled="carregando">
          {{ carregando ? 'Entrando...' : 'Entrar no painel' }}
        </button>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
const emit = defineEmits(['sucesso'])
const email = ref('')
const password = ref('')
const erro = ref('')
const carregando = ref(false)
const mostrarSenha = ref(false)

const fazerLogin = async () => {
  erro.value = ''
  carregando.value = true
  try {
    await $fetch('/api/auth', { method: 'POST', body: { email: email.value, password: password.value } })
    emit('sucesso')
  } catch (e: any) {
    erro.value = e.data?.statusMessage || 'E-mail ou senha incorretos.'
  } finally {
    carregando.value = false
  }
}
</script>
