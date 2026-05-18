<template>
  <aside class="admin-sidebar" :class="{ 'menu-open': mobileOpen }">
    <div class="admin-logo">
      <span class="logo-icon"><UiBusIcon /></span>
      <span class="brand-word">GraziTur</span>
      <button class="mobile-menu-btn" type="button" aria-label="Abrir menu" @click="mobileOpen = !mobileOpen">
        <span></span><span></span><span></span>
      </button>
    </div>

    <nav class="admin-nav" @click="fecharMobile">
      <button :class="{ active: active === 'dashboard' }" @click="selecionar('dashboard')">
        <span class="nav-icon"><svg viewBox="0 0 24 24"><path d="M4 13h6v7H4zM14 4h6v16h-6zM4 4h6v5H4z" /></svg></span>
        <span>Dashboard</span>
      </button>

      <button :class="{ 'active-soft': isViagens }" @click.stop="subOpen = !subOpen">
        <span class="nav-icon"><svg viewBox="0 0 24 24"><path d="M6 19V5l6 3 6-3v14l-6-3-6 3Z" /><path d="M12 8v8" /></svg></span>
        <span>Excursões</span>
        <span class="sidebar-chevron" :class="{ open: subOpen }">&rsaquo;</span>
      </button>
      <Transition name="submenu">
        <div v-if="subOpen" class="nav-sub">
          <button :class="{ active: active === 'excursoes-ativas' }" @click="selecionar('excursoes-ativas')">
            <span class="nav-dot"></span>
            <span>Ativas</span>
          </button>
          <button :class="{ active: active === 'excursoes-finalizadas' }" @click="selecionar('excursoes-finalizadas')">
            <span class="nav-dot"></span>
            <span>Finalizadas</span>
          </button>
        </div>
      </Transition>

      <button :class="{ 'active-soft': isPassageiros }" @click.stop="passageirosOpen = !passageirosOpen">
        <span class="nav-icon"><svg viewBox="0 0 24 24"><path d="M16 11a4 4 0 1 0-8 0" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" /><path d="M18 7.5h3" /><path d="M19.5 6v3" /></svg></span>
        <span>Passageiros</span>
        <span class="sidebar-chevron" :class="{ open: passageirosOpen }">&rsaquo;</span>
      </button>
      <Transition name="submenu">
        <div v-if="passageirosOpen" class="nav-sub">
          <button :class="{ active: active === 'passageiros' }" @click="selecionar('passageiros')">
            <span class="nav-dot"></span>
            <span>Base de passageiros</span>
          </button>
          <button :class="{ active: active === 'aniversariantes' }" @click="selecionar('aniversariantes')">
            <span class="nav-dot"></span>
            <span>Aniversariantes</span>
          </button>
        </div>
      </Transition>

      <button :class="{ active: active === 'logs' }" @click="selecionar('logs')">
        <span class="nav-icon"><svg viewBox="0 0 24 24"><path d="M8 6h13" /><path d="M8 12h13" /><path d="M8 18h13" /><path d="M3 6h.01" /><path d="M3 12h.01" /><path d="M3 18h.01" /></svg></span>
        <span>Logs</span>
      </button>

      <button :class="{ active: active === 'configuracoes' }" @click="selecionar('configuracoes')">
        <span class="nav-icon"><svg viewBox="0 0 24 24"><path d="M12 15.2A3.2 3.2 0 1 0 12 8.8a3.2 3.2 0 0 0 0 6.4Z" /><path d="M19.4 15a1.8 1.8 0 0 0 .36 1.98l.05.05a2.1 2.1 0 0 1-2.98 2.98l-.05-.05A1.8 1.8 0 0 0 14.8 19.6a1.8 1.8 0 0 0-1.1 1.65V21.4a2.1 2.1 0 0 1-4.2 0v-.08A1.8 1.8 0 0 0 8.4 19.6a1.8 1.8 0 0 0-1.98.36l-.05.05a2.1 2.1 0 0 1-2.98-2.98l.05-.05A1.8 1.8 0 0 0 3.8 15a1.8 1.8 0 0 0-1.65-1.1H2a2.1 2.1 0 0 1 0-4.2h.08A1.8 1.8 0 0 0 3.8 8.6a1.8 1.8 0 0 0-.36-1.98l-.05-.05a2.1 2.1 0 0 1 2.98-2.98l.05.05A1.8 1.8 0 0 0 8.4 4a1.8 1.8 0 0 0 1.1-1.65V2.2a2.1 2.1 0 0 1 4.2 0v.08A1.8 1.8 0 0 0 14.8 4a1.8 1.8 0 0 0 1.98-.36l.05-.05a2.1 2.1 0 0 1 2.98 2.98l-.05.05A1.8 1.8 0 0 0 19.4 8.6a1.8 1.8 0 0 0 1.65 1.1H21.2a2.1 2.1 0 0 1 0 4.2h-.08A1.8 1.8 0 0 0 19.4 15Z" /></svg></span>
        <span>Configuração</span>
      </button>

      <button class="nav-logout" @click="$emit('logout')">
        <span class="nav-icon"><svg viewBox="0 0 24 24"><path d="M10 6H6.5A2.5 2.5 0 0 0 4 8.5v7A2.5 2.5 0 0 0 6.5 18H10" /><path d="M14 8l4 4-4 4" /><path d="M18 12H9" /></svg></span>
        <span>Sair</span>
      </button>
    </nav>
  </aside>
</template>

<script setup lang="ts">
const props = defineProps<{ active: string }>()
const emit = defineEmits(['update:active', 'logout'])
const isViagens = computed(() => props.active === 'excursoes-ativas' || props.active === 'excursoes-finalizadas')
const isPassageiros = computed(() => props.active === 'passageiros' || props.active === 'aniversariantes')
const subOpen = ref(true)
const passageirosOpen = ref(false)
const mobileOpen = ref(false)
watch(isViagens, (value) => { if (value) subOpen.value = true }, { immediate: true })
watch(isPassageiros, (value) => { if (value) passageirosOpen.value = true }, { immediate: true })
const selecionar = (value: string) => {
  emit('update:active', value)
  mobileOpen.value = false
}
const fecharMobile = () => {
  if (import.meta.client && window.innerWidth <= 900) mobileOpen.value = false
}
</script>
