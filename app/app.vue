<template>
  <div>
    <NuxtPage />
  </div>
</template>

<script setup lang="ts">
useHead({
  title: 'GraziTur',
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    { name: 'theme-color', content: '#625bf6' }
  ]
})

onMounted(() => {
  const theme = localStorage.getItem('graziTurTheme') === 'dark' ? 'dark' : 'light'
  document.documentElement.setAttribute('data-theme', theme)
})
</script>
