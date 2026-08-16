<template>
  <div class="admin-login-shell min-vh-100">
    <div class="admin-login-split gt-card">
      <section class="login-copy-panel">
        <span class="badge-gt badge-contract">Recuperação segura</span>
        <h1>Crie uma nova senha administrativa.</h1>
        <p>O link é de uso único. O token é removido do endereço assim que esta página abre e não fica salvo no navegador.</p>
        <div class="login-feature-grid">
          <span>Uso único</span>
          <span>Conexão HTTPS</span>
          <span>Validação de administrador</span>
          <span>Sessões anteriores revogadas</span>
        </div>
      </section>

      <section class="login-form-panel">
        <div class="mb-4">
          <h2>Redefinir senha</h2>
          <p v-if="status === 'loading'">Validando o link de recuperação...</p>
          <p v-else-if="status === 'ready'">Escolha uma senha nova e exclusiva para o GraziTur.</p>
          <p v-else-if="status === 'success'">Sua senha foi atualizada e as sessões anteriores foram encerradas.</p>
          <p v-else>Este link não pode mais ser utilizado.</p>
        </div>

        <form v-if="status === 'ready'" @submit.prevent="salvarSenha">
          <label class="form-label" for="nova-senha">Nova senha</label>
          <div class="password-field">
            <input
              id="nova-senha"
              v-model="password"
              :type="mostrarSenha ? 'text' : 'password'"
              class="form-control"
              autocomplete="new-password"
              minlength="12"
              maxlength="128"
              required
            >
            <button
              type="button"
              class="password-toggle-btn"
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

          <label class="form-label mt-3" for="confirmar-senha">Confirmar nova senha</label>
          <input
            id="confirmar-senha"
            v-model="confirmation"
            :type="mostrarSenha ? 'text' : 'password'"
            class="form-control"
            autocomplete="new-password"
            minlength="12"
            maxlength="128"
            required
          >

          <p class="password-requirements mt-3 mb-0">Use no mínimo 12 caracteres e pelo menos três tipos entre maiúsculas, minúsculas, números e símbolos.</p>
          <p v-if="errorMessage" class="text-danger small fw-bold mt-3 mb-0" aria-live="assertive">{{ errorMessage }}</p>

          <button class="gt-btn gt-btn-primary w-100 mt-4" type="submit" :disabled="saving">
            {{ saving ? 'Atualizando...' : 'Salvar nova senha' }}
          </button>
        </form>

        <div v-else-if="status === 'success'" aria-live="polite">
          <p class="password-recovery-message">Senha atualizada com sucesso.</p>
          <NuxtLink class="gt-btn gt-btn-primary w-100 mt-4" to="/admin">Entrar no painel</NuxtLink>
        </div>

        <div v-else-if="status === 'error'">
          <p class="text-danger small fw-bold mb-0">{{ errorMessage }}</p>
          <NuxtLink class="gt-btn gt-btn-outline w-100 mt-4" to="/admin">Solicitar outro e-mail</NuxtLink>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
useHead({
  title: 'Redefinir senha | GraziTur',
  meta: [{ name: 'referrer', content: 'no-referrer' }]
})

const status = ref<'loading' | 'ready' | 'error' | 'success'>('loading')
const accessToken = ref('')
const password = ref('')
const confirmation = ref('')
const errorMessage = ref('')
const saving = ref(false)
const mostrarSenha = ref(false)

onMounted(() => {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const token = params.get('access_token') || ''
  const flowType = params.get('type') || ''
  const errorCode = params.get('error_code') || ''

  window.history.replaceState({}, document.title, window.location.pathname)

  if (errorCode || !token || (flowType && flowType !== 'recovery')) {
    errorMessage.value = errorCode === 'otp_expired'
      ? 'O link expirou ou já foi utilizado. Solicite um novo e-mail.'
      : 'O link de recuperação é inválido. Solicite um novo e-mail.'
    status.value = 'error'
    return
  }

  accessToken.value = token
  status.value = 'ready'
})

const salvarSenha = async () => {
  errorMessage.value = ''
  if (password.value !== confirmation.value) {
    errorMessage.value = 'As senhas digitadas não são iguais.'
    return
  }

  saving.value = true
  try {
    await $fetch('/api/auth', {
      method: 'POST',
      body: {
        action: 'complete-password-recovery',
        accessToken: accessToken.value,
        password: password.value
      }
    })
    accessToken.value = ''
    password.value = ''
    confirmation.value = ''
    status.value = 'success'
  } catch (e: any) {
    errorMessage.value = e.data?.statusMessage || 'Não foi possível atualizar a senha.'
  } finally {
    saving.value = false
  }
}
</script>
