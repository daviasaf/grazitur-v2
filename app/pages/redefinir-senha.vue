<template>
  <div class="admin-login-shell min-vh-100">
    <div class="admin-login-split gt-card">
      <section class="login-copy-panel">
        <h1>GraziTur</h1>
        <p>Gestão de viagens em um só lugar.</p>
      </section>

      <section class="login-form-panel">
        <h2>Recuperação indisponível</h2>
        <p>A redefinição de senha está temporariamente desativada. Fale com a administração se precisar de acesso.</p>
        <NuxtLink class="gt-btn gt-btn-primary w-100 mt-4" to="/admin">Voltar ao login</NuxtLink>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ alias: ['/admin/redefinir-senha'] })

useHead({
  title: 'Recuperação indisponível | GraziTur',
  meta: [{ name: 'referrer', content: 'no-referrer' }]
})

onMounted(() => {
  window.history.replaceState({}, document.title, window.location.pathname)
})
</script>
