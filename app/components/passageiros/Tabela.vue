<template>
  <div>
    <div class="passengers-board d-none d-md-block">
      <div class="passenger-table-head">
        <span>Passageiro</span>
        <span>Documento</span>
        <span>Celular</span>
        <span>Ações</span>
      </div>

      <button v-for="u in usuarios" :key="u.id" class="passenger-table-row" type="button" @click="$emit('vincular', u)">
        <span class="passenger-cell-main">
          <span class="passenger-avatar-soft">{{ initials(u.nome) }}</span>
          <span class="passenger-name-wrap">
            <strong>{{ u.nome }}</strong>
            <small>
              <span v-if="u.isGuia" class="guide-chip">Guia</span>
              <span v-if="u.parentes?.length">{{ pluralFamiliares(u.parentes.length) }}</span>
              <span v-else>Cadastro individual</span>
            </small>
          </span>
        </span>
        <span class="passenger-cell-muted">{{ formatCpf(u.cpf) || '-' }}</span>
        <span class="passenger-cell-muted">{{ formatPhone(u.celular) || '-' }}</span>
        <span class="passenger-actions" @click.stop>
          <button class="gt-icon-btn text-brand" title="Editar" @click="$emit('editar', u)"><svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
          <button class="gt-icon-btn text-danger" title="Excluir" @click="$emit('excluir', u)"><svg viewBox="0 0 24 24"><path d="M4 7h16"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M6 7l1 14h10l1-14"/><path d="M9 7V4h6v3"/></svg></button>
        </span>
      </button>

      <div v-if="usuarios.length === 0" class="passenger-empty-state">Nenhum passageiro encontrado.</div>
    </div>

    <div class="d-md-none passenger-mobile-list">
      <button v-for="u in usuarios" :key="u.id" class="passenger-mobile-card" type="button" @click="$emit('vincular', u)">
        <span class="passenger-avatar-soft">{{ initials(u.nome) }}</span>
        <span class="mobile-passenger-info">
          <strong>{{ u.nome }}</strong>
          <small>CPF: {{ formatCpf(u.cpf) || '-' }}</small>
          <small>Celular: {{ formatPhone(u.celular) || '-' }}</small>
          <span class="mobile-tags">
            <span v-if="u.isGuia" class="guide-chip">Guia</span>
            <span v-if="u.parentes?.length" class="family-chip">{{ pluralFamiliares(u.parentes.length) }}</span>
          </span>
        </span>
        <span class="passenger-actions" @click.stop>
          <button class="gt-icon-btn text-brand" title="Editar" @click="$emit('editar', u)"><svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
          <button class="gt-icon-btn text-danger" title="Excluir" @click="$emit('excluir', u)"><svg viewBox="0 0 24 24"><path d="M4 7h16"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M6 7l1 14h10l1-14"/><path d="M9 7V4h6v3"/></svg></button>
        </span>
      </button>
      <div v-if="usuarios.length === 0" class="passenger-empty-state">Nenhum passageiro encontrado.</div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ usuarios: any[] }>()
defineEmits(['vincular', 'editar', 'excluir'])

const initials = (nome?: string) => String(nome || 'GT').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase()
const pluralFamiliares = (total: number) => `${total} ${total === 1 ? 'familiar' : 'familiares'}`
const formatCpf = (cpf?: string) => {
  const v = String(cpf || '').replace(/\D/g, '')
  return v.length === 11 ? v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : cpf
}
const formatPhone = (fone?: string) => {
  const v = String(fone || '').replace(/\D/g, '')
  if (v.length === 11) return v.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  if (v.length === 10) return v.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
  return fone
}
</script>
