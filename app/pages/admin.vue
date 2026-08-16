<template>
  <div>
    <UiToastManager />
    <AuthAdminLogin v-if="!logado" @sucesso="aoLogar" />

    <div v-else class="admin-shell">
      <AdminSidebar v-model:active="active" @logout="pedirLogout" />

      <main class="admin-content">
        <header class="admin-topbar">
          <div class="topbar-title">
            <span class="topbar-kicker">Painel Administrativo</span>
            <strong>GraziTur Dashboard</strong>
          </div>
        </header>

        <section class="admin-page">
          <div v-if="active === 'dashboard'" class="admin-view admin-dashboard-view">
            <div class="dashboard-desktop-layout">
              <section class="dashboard-main-column">
            <div class="row g-3 mb-3 dashboard-metrics-row">
              <div class="col-md-6 col-xl-3"><div class="gt-card metric-card"><div><div class="metric-label">Receita de excursões ativas</div><div class="metric-value">{{ brl(total.receita) }}</div></div><div class="metric-icon icon-green"><svg viewBox="0 0 24 24"><path d="M5 17 17 5"/><path d="M8 5h9v9"/></svg></div></div></div>
              <div class="col-md-6 col-xl-3"><div class="gt-card metric-card"><div><div class="metric-label">Gastos de excursões ativas</div><div class="metric-value">{{ brl(total.gastos) }}</div></div><div class="metric-icon icon-red"><svg viewBox="0 0 24 24"><path d="m5 7 12 12"/><path d="M17 10v9H8"/></svg></div></div></div>
              <div class="col-md-6 col-xl-3"><div class="gt-card metric-card"><div><div class="metric-label">{{ total.lucro >= 0 ? 'Lucro de excursões ativas' : 'Prejuízo das ativas' }}</div><div class="metric-value" :class="total.lucro >= 0 ? 'text-success-gt' : 'text-danger-gt'">{{ brlAbs(total.lucro) }}</div></div><div class="metric-icon icon-blue"><svg viewBox="0 0 24 24"><path d="M12 2v20"/><path d="M17 6.5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6"/></svg></div></div></div>
              <div class="col-md-6 col-xl-3"><div class="gt-card metric-card"><div><div class="metric-label">Excursões Ativas</div><div class="metric-value">{{ excursoesAtivas.length }}</div></div><div class="metric-icon icon-orange"><svg viewBox="0 0 24 24"><path d="M6 19V5l6 3 6-3v14l-6-3-6 3Z"/><path d="M12 8v8"/></svg></div></div></div>
            </div>

            <div class="gt-card chart-card dashboard-chart-card">
              <div class="chart-card-header">
                <div>
                  <strong>Receita x gastos</strong>
                  <span>Excursões ativas</span>
                </div>
                <button class="gt-btn gt-btn-primary dashboard-report-button" @click="acaoRelatorio"><span class="btn-svg"><svg viewBox="0 0 24 24"><path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/><path d="M10 13h6"/><path d="M10 17h4"/></svg></span>Relatório geral</button>
              </div>
              <div class="chart-wrap">
                <div v-for="item in financeiroAtivas" :key="item.ex.id" class="chart-group">
                  <div class="chart-bars">
                    <div class="bar bar-receita" :style="{ height: barHeight(item.financeiro.receita) + '%' }" :title="brl(item.financeiro.receita)"></div>
                    <div class="bar bar-gasto" :style="{ height: barHeight(item.financeiro.gastos) + '%' }" :title="brl(item.financeiro.gastos)"></div>
                  </div>
                  <div class="chart-label">{{ item.ex.nome }}</div>
                </div>
                <div v-if="financeiroAtivas.length === 0" class="text-center text-muted w-100 py-5">Nenhuma excursão ativa cadastrada.</div>
              </div>
            </div>
              </section>

              <section class="dashboard-trips-column">


            <div v-for="grupo in dashboardGrupos" :key="grupo.label" class="dashboard-trip-section">
              <div class="d-flex align-items-center justify-content-between gap-2 mb-3"><div><h3 class="section-title">{{ grupo.label }}</h3><p class="text-muted small mb-0">{{ grupo.description }}</p></div></div>
              <div class="row g-3 dashboard-trip-grid">
                <div v-for="item in grupo.items" :key="item.ex.id" class="col-md-6 col-xl-4">
                  <div class="gt-card gt-card-hover p-3 h-100 position-relative dashboard-trip-card-admin">
                    <div class="dashboard-trip-card-head d-flex justify-content-between gap-3 mb-3 align-items-start">
                      <div class="min-w-0">
                        <h6 class="fw-bold mb-1 text-truncate">{{ item.ex.nome }}</h6>
                        <p class="text-muted small mb-0 lh-sm">{{ item.ex.lugar }}</p>
                      </div>
                      <div class="trip-card-top-actions flex-shrink-0">
                        <span class="badge-gt card-status-badge" :class="item.ex.finalizada ? 'badge-finalizada' : 'badge-contract'">{{ item.ex.finalizada ? 'Finalizada' : 'Ativa' }}</span>
                        <div class="dropdown-gt">
                          <button class="gt-icon-btn card-dots-btn" title="Ações da viagem" @click.stop="toggleActionMenu(item.ex.id)" aria-label="Ações"><span class="dots-menu"><span></span><span></span><span></span></span></button>
                          <div v-if="actionMenuId === item.ex.id" class="dropdown-gt-menu">
                            <button v-if="!item.ex.finalizada" @click.stop="toggleDespesaMenu(item.ex.id)">Despesa</button>
                            <div v-if="despesaMenuId === item.ex.id" class="dropdown-gt-submenu">
                              <button @click="abrirDespesa(item.ex); actionMenuId = null; despesaMenuId = null">Adicionar</button>
                              <button v-if="item.ex.despesas?.length" @click="abrirRemoverDespesa(item.ex); actionMenuId = null; despesaMenuId = null">Remover</button>
                            </div>
                            <button @click="gerarRelatorioViagem(item); actionMenuId = null; despesaMenuId = null">Relatório da viagem</button>
                            <button @click="abrirGerenciar(item.ex); actionMenuId = null; despesaMenuId = null">Ver passageiros</button>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div class="gt-subtle-card p-3">
                      <div class="d-flex justify-content-between align-items-center mb-2"><strong class="small">Resumo por empresa</strong></div>
                      <div class="breakdown-list">
                        <div class="breakdown-row"><span class="text-success-gt fw-bold">Passageiros</span><strong class="text-success-gt">{{ brl(item.financeiro.receita) }}</strong></div>
                        <div v-for="gasto in item.financeiro.gastosPorCategoria" :key="gasto.categoria" class="breakdown-row"><span class="text-danger-gt fw-bold">{{ gasto.categoria }}</span><strong class="text-danger-gt">{{ brl(gasto.valor) }}</strong></div>
                        <div v-if="item.financeiro.gastosPorCategoria.length === 0" class="breakdown-row text-muted"><span>Sem despesas registradas</span><strong>{{ brl(0) }}</strong></div>
                        <div class="breakdown-row pt-2 mt-1"><span class="fw-bold">{{ resultadoLabel(item.financeiro.lucro) }}</span><strong :class="item.financeiro.lucro >= 0 ? 'text-success-gt' : 'text-danger-gt'">{{ brlAbs(item.financeiro.lucro) }}</strong></div>
                      </div>
                    </div>
                  </div>
                </div>
                <div v-if="grupo.items.length === 0" class="col-12"><div class="gt-card p-4 text-center text-muted">Nenhuma excursão nesta categoria.</div></div>
              </div>
            </div>
              </section>
            </div>
          </div>

          <div v-if="active === 'excursoes-ativas'" class="admin-view">
            <div class="page-heading"><div><h2>Excursões Ativas</h2><p>Gerencie passageiros, pagamentos, contratos e parâmetros da viagem.</p></div><button class="gt-btn gt-btn-primary" @click="abrirNovaExcursao"><span class="btn-svg"><svg viewBox="0 0 24 24"><path d="M12 5v14"/><path d="M5 12h14"/></svg></span>Nova Excursão</button></div>
            <div class="row g-3 admin-card-grid excursion-cards-grid">
              <div v-for="ex in excursoesAtivas" :key="ex.id" class="col-md-6 col-xl-4"><ExcursoesExcursaoCard :excursao="ex" @gerenciar="abrirGerenciar" /></div>
              <div v-if="excursoesAtivas.length === 0" class="col-12"><div class="gt-card p-5 text-center text-muted">Nenhuma excursão ativa cadastrada.</div></div>
            </div>
          </div>

          <div v-if="active === 'excursoes-finalizadas'" class="admin-view">
            <div class="page-heading"><div><h2>Excursões Finalizadas</h2><p>Viagens encerradas continuam protegidas, mas podem receber ajustes mediante confirmação.</p></div></div>
            <div class="row g-3 admin-card-grid excursion-cards-grid">
              <div v-for="ex in excursoesFinalizadas" :key="ex.id" class="col-md-6 col-xl-4"><ExcursoesExcursaoCard :excursao="ex" @gerenciar="abrirGerenciar" /></div>
              <div v-if="excursoesFinalizadas.length === 0" class="col-12"><div class="gt-card p-5 text-center text-muted">Nenhuma excursão finalizada ainda.</div></div>
            </div>
          </div>

          <div v-if="active === 'passageiros'" class="admin-view">
            <div class="page-heading"><div><h2>Base de Passageiros</h2><p>Cadastros, familiares, guias e vínculo com excursões.</p></div><div class="toolbar-actions passenger-toolbar-actions"><input v-model="buscaUser" class="form-control" placeholder="Buscar passageiro..."><button class="gt-btn gt-btn-primary" @click="abrirNovoUser"><span class="btn-svg"><svg viewBox="0 0 24 24"><path d="M12 5v14"/><path d="M5 12h14"/></svg></span>Cadastro</button></div></div>
            <PassageirosTabela :usuarios="usuariosFiltrados" @vincular="abrirVincular" @editar="abrirEdicaoUser" @excluir="u => pedirConfirmacao('user', u.id, 'Excluir passageiro', 'Deseja excluir este passageiro?')" />
          </div>
          <div v-if="active === 'aniversariantes'" class="admin-view">
            <div class="page-heading">
              <div>
                <h2>Aniversariantes</h2>
                <p>Calendário mensal com aniversários, mensagens do dia e histórico do ano.</p>
              </div>
            </div>

            <div class="birthday-layout">
              <section class="gt-card birthday-calendar-card">
                <div class="birthday-calendar-toolbar">
                  <button class="gt-icon-btn" title="Mês anterior" aria-label="Mês anterior" @click="mesAniversario--"><svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg></button>
                  <div>
                    <strong>{{ mesAniversarioLabel }}</strong>
                    <span>{{ totalAniversariosMes }} neste mês</span>
                  </div>
                  <button class="gt-icon-btn" title="Próximo mês" aria-label="Próximo mês" @click="mesAniversario++"><svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg></button>
                </div>

                <div class="birthday-weekdays">
                  <span v-for="dia in diasSemanaCalendario" :key="dia">{{ dia }}</span>
                </div>

                <div class="birthday-calendar-grid">
                  <div v-for="dia in calendarioAniversarios" :key="dia.key" class="birthday-day-cell" :class="{ 'is-muted': !dia.isCurrentMonth, 'is-today': dia.isToday, 'has-birthday': dia.birthdays.length }">
                    <span class="birthday-day-number">{{ dia.day }}</span>
                    <span v-if="dia.isToday" class="birthday-today-label">Hoje</span>
                    <span v-if="dia.birthdays.length" class="birthday-day-count">{{ dia.birthdays.length }}</span>
                    <span v-for="item in dia.birthdays.slice(0, 2)" :key="item.user.id" class="birthday-day-name">{{ primeiroNomePessoa(item.user.nome) }}</span>
                    <span v-if="dia.birthdays.length > 2" class="birthday-day-more">+{{ dia.birthdays.length - 2 }}</span>
                  </div>
                </div>
              </section>

              <section class="gt-card birthday-today-card">
                <div class="birthday-section-title"><div><strong>Aniversariantes do dia</strong><span>Prontos para mandar mensagem agora.</span></div><span>{{ pluralAniversariantes(aniversariantesHoje.length) }}</span></div>
                <div v-if="aniversariantesHoje.length" class="birthday-message-list">
                  <div v-for="item in aniversariantesHoje" :key="item.user.id" class="birthday-message-row">
                    <div><strong>{{ item.user.nome }}</strong><span>{{ item.user.celular || 'Celular não informado' }}</span></div>
                    <a v-if="telefoneWhatsApp(item.user)" class="gt-btn gt-btn-success gt-btn-xs" :href="linkAniversarioWhatsApp(item.user)" target="_blank">Mensagem no WhatsApp</a>
                    <span v-else class="text-muted small">Sem celular</span>
                  </div>
                </div>
                <div v-else class="birthday-empty-panel">Nenhum aniversariante hoje.</div>
              </section>
            </div>
          </div>
          <div v-if="active === 'logs'" class="admin-view">
            <div class="page-heading"><div><h2>Logs do sistema</h2><p>Histórico das principais alterações realizadas no painel.</p></div><div class="toolbar-actions"><button class="gt-btn gt-btn-danger-outline" @click="modalApagarLogs = true">Apagar logs</button></div></div>
            <div class="gt-card p-3 p-md-4">
              <div class="logs-toolbar mb-3">
                <div class="logs-filters-grid">
                  <input v-model="buscaLog" class="form-control" placeholder="Buscar no log...">
                  <select v-model="filtroCategoriaLog" class="form-select">
                    <option value="">Todas as categorias</option>
                    <option v-for="categoria in opcoesCategoriaLog" :key="categoria" :value="categoria">{{ categoriaLogLabel(categoria) }}</option>
                  </select>
                  <select v-model="filtroExcursaoLog" class="form-select">
                    <option value="">Todas as excursões</option>
                    <option v-for="nome in opcoesExcursaoLog" :key="nome" :value="nome">{{ nome }}</option>
                  </select>
                  <input v-model="filtroDataInicialLog" type="date" class="form-control">
                  <input v-model="filtroDataFinalLog" type="date" class="form-control">
                  <button class="gt-btn gt-btn-outline" @click="limparFiltrosLogs">Limpar filtros</button>
                </div>
              </div>

              <div v-if="logsFiltrados.length === 0" class="text-center text-muted py-5">Nenhuma movimentação encontrada com os filtros atuais.</div>
              <div v-else class="table-responsive logs-table-scroll">
                <table class="table logs-table align-middle mb-0">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Categoria</th>
                      <th>Ação</th>
                      <th>Resumo</th>
                      <th class="text-end">Detalhes</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="log in logsFiltrados" :key="log.id" class="log-click-row" @click="abrirDetalhesLog(log)">
                      <td class="text-nowrap">{{ tempoRelativoLog(log.createdAt) }}</td>
                      <td><span class="log-tag">{{ categoriaLogLabel(log.entity) }}</span></td>
                      <td><strong>{{ log.title }}</strong></td>
                      <td class="text-muted log-detail-preview">{{ log.detail || '—' }}</td>
                      <td class="text-end"><button class="gt-btn gt-btn-outline gt-btn-xs" @click.stop="abrirDetalhesLog(log)">Ver</button></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div v-if="active === 'configuracoes'" class="admin-view">
            <div class="page-heading"><div><h2>Configuração</h2><p>Ferramentas do sistema, aparência e seed do banco.</p></div></div>
            <div class="row g-3 config-grid">
              <div class="col-md-6"><div class="gt-card p-4 h-100 config-card config-card-spacious"><div class="config-card-icon"><svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9Z"/></svg></div><h5 class="fw-bold mb-1">Modo de aparência</h5><p class="text-muted small mb-4">Ative ou desative o modo dark para todo o sistema.</p><button class="gt-btn gt-btn-primary" @click="alternarTema">{{ temaEscuro ? 'Desativar modo dark' : 'Ativar modo dark' }}</button></div></div>
              <div class="col-md-6"><div class="gt-card p-4 h-100 config-card config-card-spacious"><div class="config-card-icon"><svg viewBox="0 0 24 24"><path d="M6 3h9l3 3v15H6z"/><path d="M15 3v4h4"/><path d="M9 13h6"/><path d="M9 17h4"/></svg></div><h5 class="fw-bold mb-1">Gerar seed</h5><p class="text-muted small mb-4">Baixa um JSON com usuários, excursões e campos importantes do sistema.</p><button class="gt-btn gt-btn-primary w-100" @click="gerarSeedJson">Baixar seed JSON</button></div></div>
            </div>
          </div>
        </section>
      </main>
    </div>

    <ModaisModalDespesa v-if="modalDespesa" :excursao="exSelecionada" :excursoes="excursoesAtivas" @close="modalDespesa = false" @salvo="carregar" />

    <div v-if="modalRemoverDespesa" class="modal fade show d-block gt-modal-backdrop" style="z-index: 1082;">
      <div class="modal-dialog modal-dialog-centered px-3" style="max-width: 520px;">
        <div class="modal-content border-0 shadow-large">
          <div class="modal-header gt-modal-header">
            <div>
              <h5 class="fw-bold mb-0">Remover despesa</h5>
              <p class="text-muted small mb-0">Escolha uma despesa lançada em {{ exSelecionada?.nome }}.</p>
            </div>
            <button class="btn-close" @click="modalRemoverDespesa = false"></button>
          </div>
          <div class="modal-body p-3 p-md-4">
            <div v-if="!(exSelecionada?.despesas || []).length" class="gt-subtle-card p-4 text-center text-muted">Nenhuma despesa registrada nesta excursão.</div>
            <div v-else class="expense-remove-list">
              <div v-for="despesa in exSelecionada.despesas" :key="despesa.id || despesa.descricao" class="expense-remove-row">
                <div>
                  <strong>{{ despesa.descricao || 'Despesa' }}</strong>
                  <span>{{ brl(moneyNumber(despesa.valor)) }} <template v-if="despesa.data">· {{ despesa.data }}</template></span>
                </div>
                <button class="gt-btn gt-btn-danger-outline gt-btn-xs" @click="removerDespesa(despesa)">Remover</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <ModaisModalUser v-if="modalUser" :usuarioEditando="userSelecionado" :todosUsuarios="usuarios" @close="modalUser = false" @salvo="carregar" />
    <ModaisModalNovaExcursao v-if="modalExcursao" :excursaoEditando="exSelecionada" :guiasDisponiveis="guiasDisponiveis" @close="modalExcursao = false" @salvo="carregar" @apagar="id => pedirConfirmacao('excursao', id, 'Apagar excursão', 'Deseja apagar esta excursão?')" @finalizar="id => pedirConfirmacao('finalizar', id, 'Finalizar excursão', 'Tem certeza que deseja finalizar esta excursão? Ela irá para a aba de excursões finalizadas e não poderá mais ser apagada pelo painel.')" />
    <ModaisModalGerenciarEx v-if="modalGerenciar" :excursaoSelecionada="exSelecionada" @close="modalGerenciar = false" @refresh="carregar" @editar="abrirEditarExcursao()" @editarFinalizada="abrirEdicaoFinalizada" @desvincular="id => pedirConfirmacao('desvincular', id, 'Remover passageiro', 'Deseja remover este passageiro desta excursão?')" />
    <ModaisModalVincular v-if="modalVincular" :userParaVincular="userSelecionado" :excursoes="excursoesAtivas" @close="modalVincular = false" @atualizado="carregar" />
    <UiModalConfirm v-if="modalConfirm" :title="confirmTitle" :text="confirmText" @cancel="modalConfirm = false" @confirm="executarConfirmacao" />
    <UiModalConfirm v-if="modalLogout" title="Sair do painel" text="Tem certeza que deseja sair da área administrativa?" @cancel="modalLogout = false" @confirm="confirmarLogout" />

    <div v-if="logSelecionado" class="modal fade show d-block gt-modal-backdrop" style="z-index: 1085;">
      <div class="modal-dialog modal-dialog-centered px-3" style="max-width: 680px;">
        <div class="modal-content border-0 shadow-large log-detail-modal">
          <div class="modal-header gt-modal-header">
            <div>
              <h6 class="fw-bold mb-1 log-detail-title">{{ logSelecionado.title }}</h6>
              <p class="text-muted small mb-0">{{ categoriaLogLabel(logSelecionado.entity) }} · {{ tempoRelativoLog(logSelecionado.createdAt) }} · {{ formatarDataLog(logSelecionado.createdAt) }}</p>
            </div>
            <button class="btn-close" @click="logSelecionado = null"></button>
          </div>
          <div class="modal-body p-4">
            <div class="log-detail-grid log-detail-grid-compact">
              <div><span>Categoria</span><strong>{{ categoriaLogLabel(logSelecionado.entity) }}</strong></div>
              <div><span>Quando</span><strong>{{ tempoRelativoLog(logSelecionado.createdAt) }}</strong></div>
            </div>
            <div class="log-human-card mt-3">
              <strong class="d-block mb-2">O que aconteceu</strong>
              <ul>
                <li v-for="(linha, index) in linhasLogDetalhe(logSelecionado)" :key="index">{{ linha }}</li>
              </ul>
            </div>
          </div>
          <div class="modal-footer">
            <button class="gt-btn gt-btn-primary" @click="logSelecionado = null">Fechar</button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="modalApagarLogs" class="modal fade show d-block gt-modal-backdrop" style="z-index: 1084;">
      <div class="modal-dialog modal-dialog-centered px-3" style="max-width: 620px;">
        <div class="modal-content border-0 shadow-large">
          <div class="modal-header gt-modal-header">
            <div>
              <h5 class="fw-bold mb-0">Apagar logs</h5>
              <p class="text-muted small mb-0">Escolha filtros para remover apenas os registros desejados.</p>
            </div>
            <button class="btn-close" @click="modalApagarLogs = false"></button>
          </div>
          <div class="modal-body p-3 p-md-4">
            <div class="delete-logs-grid">
              <div>
                <label class="form-label small fw-bold">Categoria</label>
                <select v-model="deleteLogForm.entity" class="form-select">
                  <option value="">Todas</option>
                  <option v-for="categoria in opcoesCategoriaLog" :key="categoria" :value="categoria">{{ categoriaLogLabel(categoria) }}</option>
                </select>
              </div>
              <div>
                <label class="form-label small fw-bold">Tipo técnico</label>
                <select v-model="deleteLogForm.action" class="form-select">
                  <option value="">Todos</option>
                  <option v-for="acao in opcoesAcaoLog" :key="acao" :value="acao">{{ acao }}</option>
                </select>
              </div>
              <div>
                <label class="form-label small fw-bold">Excursão</label>
                <select v-model="deleteLogForm.excursao" class="form-select">
                  <option value="">Todas</option>
                  <option v-for="nome in opcoesExcursaoLog" :key="nome" :value="nome">{{ nome }}</option>
                </select>
              </div>
              <div>
                <label class="form-label small fw-bold">Texto específico</label>
                <input v-model="deleteLogForm.termo" class="form-control" placeholder="Ex: pagamento, passageiro...">
              </div>
              <div>
                <label class="form-label small fw-bold">Data inicial</label>
                <input v-model="deleteLogForm.dataInicial" type="date" class="form-control">
              </div>
              <div>
                <label class="form-label small fw-bold">Data final</label>
                <input v-model="deleteLogForm.dataFinal" type="date" class="form-control">
              </div>
            </div>
            <div class="gt-subtle-card p-3 mt-3 small text-muted">
              Sem filtros, todos os logs serão apagados. Os registros removidos não podem ser recuperados.
            </div>
          </div>
          <div class="modal-footer">
            <button class="gt-btn gt-btn-outline" @click="modalApagarLogs = false">Cancelar</button>
            <button class="gt-btn gt-btn-danger-outline" @click="solicitarApagarLogs">Apagar logs</button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="modalRelatorio" class="modal fade show d-block gt-modal-backdrop" style="z-index: 1080;">
      <div class="modal-dialog modal-dialog-centered px-3" style="max-width: 420px;">
        <div class="modal-content border-0 shadow-large">
          <div class="modal-header gt-modal-header"><div><h5 class="fw-bold mb-0">Relatório geral</h5><p class="text-muted small mb-0">Escolha quantos meses deseja analisar.</p></div><button class="btn-close" @click="modalRelatorio = false"></button></div>
          <div class="modal-body p-4"><label class="form-label small fw-bold">Período em meses</label><input v-model="mesesRelatorio" type="number" min="1" max="60" class="form-control" placeholder="Ex: 12"><div class="gt-subtle-card p-3 mt-3 small text-muted">Exemplo: coloque 12 para gerar o relatório dos últimos 1 ano.</div></div>
          <div class="modal-footer"><button class="gt-btn gt-btn-outline" @click="modalRelatorio = false">Cancelar</button><button class="gt-btn gt-btn-primary" @click="confirmarRelatorio">Gerar relatório</button></div>
        </div>
      </div>
    </div>

    <UiModalConfirm
      v-if="modalConfirmApagarLogs"
      title="Apagar logs"
      :text="textoConfirmacaoApagarLogs"
      @cancel="modalConfirmApagarLogs = false"
      @confirm="confirmarApagarLogs"
    />
  </div>
</template>

<script setup lang="ts">
import { brl, moneyToNumber, onlyDigits } from '~/utils/formatadores'
import { exportarRelatorioGeralPDF, exportarRelatorioExcursaoPDF } from '~/utils/exportacoes'

type Despesa = { id?: string; descricao?: string; valor: number | string; categoria?: string; data?: string }
type Financeiro = { receita: number; gastos: number; lucro: number; gastosPorCategoria: Array<{ categoria: string; valor: number }> }

const { showToast } = useToasts()
const logado = ref(false)
const active = ref('dashboard')
const usuarios = ref<any[]>([])
const excursoes = ref<any[]>([])
const logs = ref<any[]>([])
const buscaUser = ref('')
const modalUser = ref(false)
const modalExcursao = ref(false)
const modalGerenciar = ref(false)
const modalVincular = ref(false)
const modalDespesa = ref(false)
const modalRemoverDespesa = ref(false)
const modalConfirm = ref(false)
const modalRelatorio = ref(false)
const modalLogout = ref(false)
const modalApagarLogs = ref(false)
const modalConfirmApagarLogs = ref(false)
const temaEscuro = ref(false)
const mesesRelatorio = ref(12)
const userSelecionado = ref<any>(null)
const exSelecionada = ref<any>(null)
const confirmType = ref('')
const confirmId = ref<number | null>(null)
const confirmTitle = ref('')
const confirmText = ref('')
const actionMenuId = ref<number | null>(null)
const despesaMenuId = ref<number | null>(null)
const buscaLog = ref('')
const filtroCategoriaLog = ref('')
const filtroExcursaoLog = ref('')
const filtroDataInicialLog = ref('')
const filtroDataFinalLog = ref('')
const logSelecionado = ref<any>(null)
const deleteLogForm = reactive({ entity: '', action: '', excursao: '', dataInicial: '', dataFinal: '', termo: '' })

const parseJson = <T,>(v: any, fallback: T): T => {
  if (!v) return fallback
  if (typeof v !== 'string') return v
  try { return JSON.parse(v) } catch { return fallback }
}
const moneyNumber = (input: any) => moneyToNumber(input)
const totalPagamento = (p?: string) => {
  if (!p || /isento/i.test(p)) return 0
  const m = p.match(/(\d+)\s*x\s*de\s*R\$?\s*([\d.,]+)/i)
  if (m) return Number(m[1]) * moneyNumber(m[2])
  const s = p.match(/R\$\s*([\d.,]+)/i)
  return s ? moneyNumber(s[1]) : 0
}
const totalValor = (v: any) => (Number(v?.vezes) || 1) * moneyNumber(v?.valor)
const brlAbs = (valor: number) => brl(Math.abs(Number(valor || 0)))
const resultadoLabel = (valor: number) => Number(valor || 0) >= 0 ? 'Lucro' : 'Prejuízo'
const calcularFinanceiro = (ex: any): Financeiro => {
  let receita = 0
  for (const u of ex.usuarios || []) {
    const pag = ex.pagamentos?.[String(u.id)]
    if (pag) receita += totalPagamento(pag)
    else if (!ex.aplicarParcelas && ex.valores?.[0]) receita += totalValor(ex.valores[0])
  }
  const mapaCategorias = new Map<string, number>()
  const gastos = (ex.despesas || []).reduce((s: number, d: Despesa) => {
    const valor = Math.abs(moneyNumber(d.valor))
    const categoria = String(d.descricao || 'Despesa').trim()
    mapaCategorias.set(categoria, (mapaCategorias.get(categoria) || 0) + valor)
    return s + valor
  }, 0)
  const gastosPorCategoria = [...mapaCategorias.entries()].map(([categoria, valor]) => ({ categoria, valor }))
  return { receita, gastos, lucro: receita - gastos, gastosPorCategoria }
}
const formatarExcursao = (ex: any) => ({
  ...ex,
  valores: parseJson(ex.valores, []),
  pagamentos: parseJson(ex.pagamentosJson, {}),
  detalhes: parseJson(ex.contratoDetalhes, {}),
  grupos: parseJson(ex.contratoGrupos, {}),
  assinaturas: parseJson(ex.assinaturasJson, {}),
  despesas: parseJson(ex.despesasJson, []),
  listaEspera: parseJson(ex.listaEsperaJson, [])
})

const excursoesAtivas = computed(() => excursoes.value.filter((e) => !e.finalizada))
const excursoesFinalizadas = computed(() => excursoes.value.filter((e) => e.finalizada))
const financeiroTodas = computed(() => excursoes.value.map((ex) => ({ ex, financeiro: calcularFinanceiro(ex) })))
const financeiroAtivas = computed(() => financeiroTodas.value.filter((item) => !item.ex.finalizada))
const financeiroFinalizadas = computed(() => financeiroTodas.value.filter((item) => item.ex.finalizada))
const dashboardGrupos = computed(() => [
  { label: 'Excursões ativas', description: 'Viagens abertas e em andamento.', items: financeiroAtivas.value },
  { label: 'Excursões finalizadas', description: 'Histórico das viagens encerradas, com edição condicionada à confirmação.', items: financeiroFinalizadas.value }
])
const total = computed(() => financeiroAtivas.value.reduce((acc, item) => ({ receita: acc.receita + item.financeiro.receita, gastos: acc.gastos + item.financeiro.gastos, lucro: acc.lucro + item.financeiro.lucro }), { receita: 0, gastos: 0, lucro: 0 }))
const maiorValorGrafico = computed(() => Math.max(1, ...financeiroAtivas.value.flatMap((i) => [i.financeiro.receita, i.financeiro.gastos])))
const barHeight = (valor: number) => Math.max(2, (valor / maiorValorGrafico.value) * 100)
const formatarDataLog = (valor: string) => new Date(valor).toLocaleString('pt-BR')
const tempoRelativoLog = (valor: string) => {
  const diff = Date.now() - new Date(valor).getTime()
  const min = Math.max(0, Math.floor(diff / 60000))
  if (min < 1) return 'agora'
  if (min < 60) return `${min} minuto${min === 1 ? '' : 's'} atrás`
  const horas = Math.floor(min / 60)
  if (horas < 24) return `${horas} hora${horas === 1 ? '' : 's'} atrás`
  const dias = Math.floor(horas / 24)
  if (dias < 7) return `${dias} dia${dias === 1 ? '' : 's'} atrás`
  const semanas = Math.floor(dias / 7)
  if (semanas < 5) return `${semanas} semana${semanas === 1 ? '' : 's'} atrás`
  const meses = Math.floor(dias / 30)
  return `${meses} mês${meses === 1 ? '' : 'es'} atrás`
}
const acaoLogLabel = (acao: string) => String(acao || 'manual').replace(/-/g, ' ')
const linhasLogDetalhe = (log: any) => {
  const linhas = String(log?.detail || '').split(/\n+/).map((linha) => linha.trim()).filter(Boolean).filter((linha) => !/^CPF:/i.test(linha))
  return linhas.length ? linhas : ['Nenhum detalhe adicional foi salvo para este log.']
}
const categoriaLogLabel = (entity: string) => ({
  excursao: 'Excursão',
  user: 'Passageiro',
  vinculo: 'Vínculo',
  contrato: 'Contrato',
  financeiro: 'Financeiro',
  sistema: 'Sistema'
} as Record<string, string>)[entity] || entity
const opcoesCategoriaLog = computed(() => [...new Set(logs.value.map((log) => String(log.entity || 'sistema')))].sort((a, b) => a.localeCompare(b, 'pt-BR')))
const opcoesExcursaoLog = computed(() => [...new Set(excursoes.value.map((ex) => String(ex.nome || '')))].filter(Boolean).sort((a, b) => a.localeCompare(b, 'pt-BR')))
const opcoesAcaoLog = computed(() => [...new Set(logs.value.map((log) => String(log.action || 'manual')))].filter(Boolean).sort((a, b) => a.localeCompare(b, 'pt-BR')))
const logSelecionadoJson = computed(() => logSelecionado.value ? JSON.stringify(logSelecionado.value, null, 2) : '')
const logsFiltrados = computed(() => logs.value.filter((log) => {
  const texto = `${log.title || ''} ${log.detail || ''}`.toLowerCase()
  const termo = buscaLog.value.toLowerCase().trim()
  if (termo && !texto.includes(termo)) return false
  if (filtroCategoriaLog.value && String(log.entity || '') !== filtroCategoriaLog.value) return false
  if (filtroExcursaoLog.value && !texto.includes(filtroExcursaoLog.value.toLowerCase())) return false
  const dataLog = new Date(log.createdAt)
  if (filtroDataInicialLog.value) {
    const inicio = new Date(`${filtroDataInicialLog.value}T00:00:00`)
    if (dataLog < inicio) return false
  }
  if (filtroDataFinalLog.value) {
    const fim = new Date(`${filtroDataFinalLog.value}T23:59:59`)
    if (dataLog > fim) return false
  }
  return true
}))
const abrirDetalhesLog = (log: any) => { logSelecionado.value = log }
const limparFiltrosLogs = () => {
  buscaLog.value = ''
  filtroCategoriaLog.value = ''
  filtroExcursaoLog.value = ''
  filtroDataInicialLog.value = ''
  filtroDataFinalLog.value = ''
}
const resetarFormularioApagarLogs = () => {
  deleteLogForm.entity = ''
  deleteLogForm.action = ''
  deleteLogForm.excursao = ''
  deleteLogForm.dataInicial = ''
  deleteLogForm.dataFinal = ''
  deleteLogForm.termo = ''
}
const temFiltroApagarLogs = computed(() => Object.values(deleteLogForm).some((valor) => String(valor || '').trim()))
const textoConfirmacaoApagarLogs = computed(() => temFiltroApagarLogs.value
  ? 'Tem certeza que deseja apagar os logs que correspondem aos filtros selecionados? Essa ação não pode ser desfeita.'
  : 'Nenhum filtro foi selecionado. Tem certeza que deseja apagar todos os logs do sistema? Essa ação não pode ser desfeita.'
)
const solicitarApagarLogs = () => { modalConfirmApagarLogs.value = true }
const confirmarApagarLogs = async () => {
  modalConfirmApagarLogs.value = false
  try {
    const res = await $fetch<any>('/api/logs/clear', { method: 'POST', body: { ...deleteLogForm } })
    showToast(`${res.deleted || 0} log(s) apagado(s).`, 'success')
    modalApagarLogs.value = false
    resetarFormularioApagarLogs()
    logs.value = await $fetch<any[]>('/api/logs').catch(() => [])
  } catch (e: any) {
    showToast(e.data?.statusMessage || 'Erro ao apagar logs.', 'danger')
  }
}
const aplicarTema = () => { if (import.meta.client) document.documentElement.setAttribute('data-theme', temaEscuro.value ? 'dark' : 'light') }

onMounted(async () => {
  if (import.meta.client) {
    temaEscuro.value = localStorage.getItem('graziTurTheme') === 'dark'
    aplicarTema()
    const session = await $fetch<{ authenticated: boolean }>('/api/auth').catch(() => ({ authenticated: false }))
    if (session.authenticated) {
      logado.value = true
      await carregar()
    }
  }
})
const aoLogar = () => { logado.value = true; carregar() }
const pedirLogout = () => { modalLogout.value = true }
const confirmarLogout = async () => {
  modalLogout.value = false
  await $fetch('/api/auth', { method: 'DELETE' }).catch(() => null)
  logado.value = false
  usuarios.value = []
  excursoes.value = []
  logs.value = []
}
const alternarTema = () => { temaEscuro.value = !temaEscuro.value; if (import.meta.client) localStorage.setItem('graziTurTheme', temaEscuro.value ? 'dark' : 'light'); aplicarTema() }
const carregar = async () => {
  usuarios.value = await $fetch<any[]>('/api/users')
  const res = await $fetch<any[]>('/api/excursoes')
  excursoes.value = res.map(formatarExcursao)
  logs.value = await $fetch<any[]>('/api/logs').catch(() => [])
  if (exSelecionada.value) exSelecionada.value = excursoes.value.find((e) => e.id === exSelecionada.value.id) || exSelecionada.value
}
const acaoRelatorio = () => { modalRelatorio.value = true }
const confirmarRelatorio = () => { modalRelatorio.value = false; exportarRelatorioGeralPDF(excursoes.value, usuarios.value, showToast, Number(mesesRelatorio.value) || 12) }
const toggleActionMenu = (id: number) => { actionMenuId.value = actionMenuId.value === id ? null : id; despesaMenuId.value = null }
const toggleDespesaMenu = (id: number) => { despesaMenuId.value = despesaMenuId.value === id ? null : id }
const gerarRelatorioViagem = async (item: { ex: any, financeiro: Financeiro }) => {
  const purpose = 'Relatório administrativo da excursão'
  const sensitive = await $fetch<any>(`/api/excursoes/${item.ex.id}`, { query: { purpose } })
  await exportarRelatorioExcursaoPDF(formatarExcursao(sensitive), item.financeiro, showToast)
}
const abrirDespesa = (ex: any | null) => { exSelecionada.value = ex; modalDespesa.value = true }
const abrirRemoverDespesa = (ex: any) => { exSelecionada.value = ex; modalRemoverDespesa.value = true }
const removerDespesa = async (despesa: any) => {
  if (!exSelecionada.value) return
  const despesas = (exSelecionada.value.despesas || []).filter((d: any) => String(d.id || d.descricao) !== String(despesa.id || despesa.descricao))
  await $fetch(`/api/excursoes/${exSelecionada.value.id}`, {
    method: 'PUT',
    body: {
      ...exSelecionada.value,
      valores: JSON.stringify(exSelecionada.value.valores || []),
      pagamentosJson: JSON.stringify(exSelecionada.value.pagamentos || {}),
      contratoDetalhes: JSON.stringify(exSelecionada.value.detalhes || {}),
      contratoGrupos: JSON.stringify(exSelecionada.value.grupos || {}),
      despesasJson: JSON.stringify(despesas),
      listaEsperaJson: JSON.stringify(exSelecionada.value.listaEspera || []),
      mostrarAberta: exSelecionada.value.mostrarAberta ?? true
    }
  })
  showToast('Despesa removida.', 'success')
  modalRemoverDespesa.value = false
  await carregar()
}
const abrirNovoUser = () => { userSelecionado.value = null; modalUser.value = true }
const abrirEdicaoUser = async (u: any) => {
  userSelecionado.value = await $fetch(`/api/users/${u.id}`, { query: { reveal: 'cpf' } })
  modalUser.value = true
}
const abrirVincular = (u: any) => { userSelecionado.value = u; modalVincular.value = true }
const abrirNovaExcursao = () => { exSelecionada.value = null; modalExcursao.value = true }
const abrirGerenciar = (ex: any) => { exSelecionada.value = excursoes.value.find((e) => e.id === ex.id); modalGerenciar.value = true }
const abrirEditarExcursao = (ex?: any) => { exSelecionada.value = ex || exSelecionada.value; modalGerenciar.value = false; modalExcursao.value = true }
const abrirEdicaoFinalizada = (ex: any) => { pedirConfirmacao('editar-finalizada', ex.id, 'Editar excursão finalizada', 'Essa excursão já está finalizada. Deseja liberar a edição manual mesmo assim? Essa ação será registrada no log.') }
const pedirConfirmacao = (tipo: string, id: number, titulo: string, texto: string) => { confirmType.value = tipo; confirmId.value = id; confirmTitle.value = titulo; confirmText.value = texto; modalConfirm.value = true }
const executarConfirmacao = async () => {
  modalConfirm.value = false
  try {
    if (confirmType.value === 'user') await $fetch(`/api/users/${confirmId.value}`, { method: 'DELETE' })
    if (confirmType.value === 'excursao') { await $fetch(`/api/excursoes/${confirmId.value}`, { method: 'DELETE' }); modalExcursao.value = false }
    if (confirmType.value === 'desvincular') {
      await $fetch('/api/desvincular', { method: 'POST', body: { userId: confirmId.value, excursaoId: exSelecionada.value?.id } })
      showToast('Passageiro removido da excursão.', 'success')
      await carregar()
      return
    }
    if (confirmType.value === 'editar-finalizada') {
      const ex = excursoes.value.find((item) => item.id === confirmId.value) || exSelecionada.value
      exSelecionada.value = ex
      await $fetch('/api/logs', {
        method: 'POST',
        body: {
          entity: 'excursao',
          action: 'unlock-finalized-edit',
          title: 'Edição de excursão finalizada liberada',
          detail: `${ex?.nome || 'Excursão'} foi aberta para edição manual após confirmação do administrador.`
        }
      })
      modalGerenciar.value = false
      modalExcursao.value = true
      showToast('Edição da excursão finalizada liberada.', 'success')
      await carregar()
      return
    }
    if (confirmType.value === 'finalizar') {
      await $fetch(`/api/excursoes/${confirmId.value}`, { method: 'PUT', body: { finalizada: true } })
      modalExcursao.value = false
      modalGerenciar.value = false
      active.value = 'excursoes-finalizadas'
      showToast('Excursão finalizada e movida para a aba Finalizadas.', 'success')
      await carregar()
      return
    }
    showToast('Ação concluída com sucesso.', 'success')
    await carregar()
  } catch (e: any) { showToast(e.data?.statusMessage || 'Erro ao executar ação.', 'danger') }
}
const usuariosFiltrados = computed(() => {
  const q = buscaUser.value.toLowerCase().trim()
  if (!q) return usuarios.value
  return usuarios.value.filter((u) => u.nome.toLowerCase().includes(q) || String(u.cpf || '').includes(q))
})
type BirthdayStatus = 'hoje' | 'amanha' | 'ontem' | 'passado'
type BirthdayItem = { user: any; status: BirthdayStatus; label: string; sort: number }
type CalendarBirthdayDay = { key: string; date: Date; day: number; isCurrentMonth: boolean; isToday: boolean; birthdays: BirthdayItem[] }
const pluralAniversariantes = (total: number) => `${total} ${total === 1 ? 'aniversariante' : 'aniversariantes'}`
const mesAniversario = ref(0)
const inicioDoDia = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())
const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const nascimentoDiaMes = (value: any) => {
  const digits = onlyDigits(String(value || ''))
  if (digits.length < 4) return null
  const dia = Number(digits.slice(0, 2))
  const mes = Number(digits.slice(2, 4))
  if (dia < 1 || dia > 31 || mes < 1 || mes > 12) return null
  return { dia, mes }
}
const diasEntre = (a: Date, b: Date) => Math.round((inicioDoDia(a).getTime() - inicioDoDia(b).getTime()) / 86400000)
const aniversarioNoAno = (nascimento: any, ano: number) => {
  const parsed = nascimentoDiaMes(nascimento)
  if (!parsed) return null
  const data = new Date(ano, parsed.mes - 1, parsed.dia)
  if (data.getMonth() !== parsed.mes - 1 || data.getDate() !== parsed.dia) return null
  return data
}
const classificarAniversario = (user: any): BirthdayItem | null => {
  const hoje = inicioDoDia(new Date())
  const dataAtual = aniversarioNoAno(user.nascimento, hoje.getFullYear())
  if (!dataAtual) return null
  const datas = [
    aniversarioNoAno(user.nascimento, hoje.getFullYear() - 1),
    dataAtual,
    aniversarioNoAno(user.nascimento, hoje.getFullYear() + 1)
  ].filter(Boolean) as Date[]
  const diffMaisProximo = datas.map((data) => diasEntre(data, hoje)).sort((a, b) => Math.abs(a) - Math.abs(b))[0]
  const diff = diffMaisProximo
  if (diff === 0) return { user, status: 'hoje', label: 'Hoje', sort: 0 }
  if (diff === 1) return { user, status: 'amanha', label: 'Amanhã', sort: 1 }
  if (diff === -1) return { user, status: 'ontem', label: 'Ontem', sort: 2 }
  const diffAtual = diasEntre(dataAtual, hoje)
  if (diffAtual < -1) return { user, status: 'passado', label: `Já passou (${Math.abs(diffAtual)} dias)`, sort: 3 + Math.abs(diffAtual) / 1000 }
  return null
}
const aniversariantesOrdenados = computed<BirthdayItem[]>(() => usuarios.value.map(classificarAniversario).filter((item): item is BirthdayItem => Boolean(item)).sort((a, b) => a.sort - b.sort || String(a.user.nome || '').localeCompare(String(b.user.nome || ''), 'pt-BR')))
const aniversariantesHoje = computed(() => aniversariantesOrdenados.value.filter((item) => item.status === 'hoje'))
const aniversariantesAmanha = computed(() => aniversariantesOrdenados.value.filter((item) => item.status === 'amanha'))
const aniversariantesOntem = computed(() => aniversariantesOrdenados.value.filter((item) => item.status === 'ontem'))
const aniversariantesPassados = computed(() => aniversariantesOrdenados.value.filter((item) => item.status === 'passado'))
const diasSemanaCalendario = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const mesAniversarioData = computed(() => {
  const hoje = new Date()
  return new Date(hoje.getFullYear(), hoje.getMonth() + mesAniversario.value, 1)
})
const mesAniversarioLabel = computed(() => mesAniversarioData.value.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }))
const aniversariosDoMes = computed(() => {
  const base = mesAniversarioData.value
  return usuarios.value.map((user) => {
    const data = aniversarioNoAno(user.nascimento, base.getFullYear())
    if (!data || data.getMonth() !== base.getMonth()) return null
    return { user, status: 'hoje' as BirthdayStatus, label: user.nascimento || '', sort: data.getDate(), date: data }
  }).filter(Boolean) as Array<BirthdayItem & { date: Date }>
})
const totalAniversariosMes = computed(() => aniversariosDoMes.value.length)
const calendarioAniversarios = computed<CalendarBirthdayDay[]>(() => {
  const base = mesAniversarioData.value
  const start = new Date(base.getFullYear(), base.getMonth(), 1)
  start.setDate(start.getDate() - start.getDay())
  const hojeKey = dateKey(new Date())
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    const key = dateKey(date)
    const birthdays = aniversariosDoMes.value
      .filter((item) => dateKey(item.date) === key)
      .sort((a, b) => String(a.user.nome || '').localeCompare(String(b.user.nome || ''), 'pt-BR'))
    return { key, date, day: date.getDate(), isCurrentMonth: date.getMonth() === base.getMonth(), isToday: key === hojeKey, birthdays }
  })
})
const primeiroNomePessoa = (nome: string) => String(nome || '').trim().split(/\s+/)[0] || 'Nome'
const telefoneWhatsApp = (user: any) => {
  const phone = onlyDigits(user?.celular)
  return phone.length >= 10 ? phone : ''
}
const linkAniversarioWhatsApp = (user: any) => {
  const msg = `Feliz Aniversário!

Hoje é um dia muito especial, e a Grazi Turismo não poderia deixar de passar por aqui para desejar muitas felicidades, saúde, paz e momentos inesquecíveis na sua vida!

Que esse novo ciclo venha cheio de conquistas, alegria, sonhos realizados e muitas viagens incríveis pelo caminho!

Obrigada por fazer parte da nossa história. Esperamos continuar criando memórias especiais com você!

Com carinho,
Grazi`
  return `https://wa.me/55${telefoneWhatsApp(user)}?text=${encodeURIComponent(msg)}`
}
const gerarSeedJson = async () => {
  try {
    const purpose = window.prompt('Informe a finalidade autorizada para exportar dados pessoais:')?.trim()
    if (!purpose || purpose.length < 8) return
    const payload = await $fetch<any>('/api/seed/export', { query: { purpose } })
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `grazitur-seed-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(link.href)
    showToast('Seed JSON gerado com sucesso.', 'success')
  } catch (e: any) {
    showToast(e.data?.statusMessage || 'Erro ao gerar seed.', 'danger')
  }
}
const guiasDisponiveis = computed(() => usuarios.value.filter((u) => u.isGuia))
</script>
