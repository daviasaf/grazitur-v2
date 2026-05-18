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
        <input v-model="email" type="email" class="form-control" placeholder="admin@grazitur.com" @keyup.enter="fazerLogin">

        <label class="form-label mt-3">Senha</label>
        <input v-model="password" type="password" class="form-control" placeholder="Digite sua senha" @keyup.enter="fazerLogin">

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
const email = ref('admin@grazitur.com')
const password = ref('')
const erro = ref('')
const carregando = ref(false)

const fazerLogin = async () => {
  erro.value = ''
  carregando.value = true
  try {
    await $fetch('/api/auth', { method: 'POST', body: { email: email.value, password: password.value } })
    if (import.meta.client) localStorage.setItem('graziTurAdmin', 'true')
    emit('sucesso')
  } catch (e: any) {
    erro.value = e.data?.statusMessage || 'E-mail ou senha incorretos.'
  } finally {
    carregando.value = false
  }
}
</script>
