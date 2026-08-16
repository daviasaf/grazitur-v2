import { zipSync, strToU8 } from 'fflate'
import { brl, mascaraCPF, moneyToNumber } from './formatadores'

type ToastFn = (message: string, type?: string) => void
export type ListaPassageiroColunaId = 'nome' | 'cpf' | 'orgaoExpeditor' | 'idade' | 'rg' | 'nascimento' | 'celular' | 'cidade' | 'endereco' | 'email' | 'pagamento'
export type ListaPassageirosOrdenacao = 'alfabetica' | 'grupos'
type ListaPassageiroColuna = { id: ListaPassageiroColunaId; label: string; value: (user: any, excursao: any) => string }
type ListaPassageiroSecao = { passageiros: any[]; tipo: 'lista' | 'grupo' | 'sem-grupo'; corGrupo?: 0 | 1; numeroGrupo?: number }

const CORES_GRUPOS_PDF = [[229, 236, 216], [238, 235, 255]] as const

type Financeiro = {
  receita: number
  gastos: number
  lucro: number
  gastosPorCategoria?: Array<{ categoria: string; valor: number }>
}

const safeName = (value: string) => String(value || 'arquivo').replace(/[^a-z0-9-_]+/gi, '_')
const onlyDigits = (v: any) => String(v || '').replace(/\D/g, '')
const xmlEscape = (v: any) => String(v ?? '').replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c] || c))
const htmlEscape = (v: any) => String(v ?? '').replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c] || c))
const brDateTime = (value?: any) => value ? new Date(value).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : ''
export const LISTA_PASSAGEIROS_COLUNAS: ListaPassageiroColuna[] = [
  { id: 'nome', label: 'Nome', value: (u) => u.nomeLista || u.nome || '-' },
  { id: 'cpf', label: 'CPF', value: (u) => mascaraCPF(String(u.cpf || '')) || '-' },
  { id: 'orgaoExpeditor', label: 'Órgão expeditor', value: (u) => u.orgaoExpeditor || '-' },
  { id: 'idade', label: 'Idade', value: (u) => u.idade === null || u.idade === undefined || u.idade === '' ? '-' : String(u.idade) },
  { id: 'rg', label: 'RG', value: (u) => u.rg || '-' },
  { id: 'nascimento', label: 'Nascimento', value: (u) => u.nascimento || '-' },
  { id: 'celular', label: 'Celular', value: (u) => u.celular || '-' },
  { id: 'cidade', label: 'Cidade', value: (u) => u.cidade || '-' },
  { id: 'endereco', label: 'Endereço', value: (u) => u.endereco || '-' },
  { id: 'email', label: 'E-mail', value: (u) => u.email || '-' },
  { id: 'pagamento', label: 'Pagamento', value: (u, ex) => ex.pagamentos?.[String(u.id)] || 'Pendente' }
]
const colunasLista = (ids?: ListaPassageiroColunaId[]) => {
  const selecionadas = (ids?.length ? ids : ['nome', 'cpf', 'orgaoExpeditor']).map(String)
  return LISTA_PASSAGEIROS_COLUNAS.filter((coluna) => selecionadas.includes(coluna.id))
}

const moneyNumber = (input: any) => moneyToNumber(input)

const totalPagamento = (p?: string) => {
  if (!p || /isento/i.test(p)) return 0
  const m = p.match(/(\d+)\s*x\s*de\s*R\$?\s*([\d.,]+)/i)
  if (m) return Number(m[1]) * moneyNumber(m[2])
  const s = p.match(/R\$\s*([\d.,]+)/i)
  return s ? moneyNumber(s[1]) : 0
}

function calcularFinanceiro(ex: any): Financeiro {
  let receita = 0
  for (const u of ex.usuarios || []) receita += totalPagamento(ex.pagamentos?.[String(u.id)])

  const mapa = new Map<string, number>()
  const gastos = (ex.despesas || []).reduce((acc: number, d: any) => {
    const valor = Math.abs(moneyNumber(d.valor))
    const nome = String(d.descricao || 'Despesa').trim()
    mapa.set(nome, (mapa.get(nome) || 0) + valor)
    return acc + valor
  }, 0)

  return {
    receita,
    gastos,
    lucro: receita - gastos,
    gastosPorCategoria: [...mapa.entries()].map(([categoria, valor]) => ({ categoria, valor }))
  }
}

async function getPdfTools() {
  const { jsPDF } = await import('jspdf')
  const autoTableModule = await import('jspdf-autotable')
  const autoTable = (autoTableModule as any).default || autoTableModule
  return { jsPDF, autoTable }
}

function passageirosDaExcursao(excursao: any) {
  const usuarios = [...(excursao.usuarios || [])]
  const guia = excursao.guia
  const guiaId = excursao.guiaId ? String(excursao.guiaId) : ''
  const guiaCpf = onlyDigits(guia?.cpf)

  if (guia) {
    const guiaJaNaLista = usuarios.some((u: any) => {
      const mesmoId = guiaId && String(u.id) === guiaId
      const mesmoCpf = guiaCpf && onlyDigits(u.cpf) === guiaCpf
      return mesmoId || mesmoCpf
    })
    if (!guiaJaNaLista) usuarios.push({ ...guia, id: guia.id, _guiaLista: true })
  }

  return usuarios.map((u: any) => {
    const ehGuiaDaExcursao = (guiaId && String(u.id) === guiaId) || (guiaCpf && onlyDigits(u.cpf) === guiaCpf) || Boolean(u._guiaLista)
    return { ...u, _guiaLista: ehGuiaDaExcursao }
  })
}

const compararNomes = (a: any, b: any) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR')
const nomePassageiroLista = (passageiro: any) => `${passageiro._guiaLista ? '(Guia) ' : ''}${passageiro.nome || ''}`

function passageirosOrdenados(excursao: any) {
  return passageirosDaExcursao(excursao)
    .sort(compararNomes)
    .map((passageiro: any) => ({ ...passageiro, nomeLista: nomePassageiroLista(passageiro) }))
}

function secoesListaPassageiros(excursao: any, ordenacao: ListaPassageirosOrdenacao): ListaPassageiroSecao[] {
  if (ordenacao === 'alfabetica') {
    return [{ passageiros: passageirosOrdenados(excursao), tipo: 'lista' }]
  }

  const passageiros = passageirosDaExcursao(excursao)
  const passageirosPorId = new Map(passageiros.map((passageiro: any) => [String(passageiro.id), passageiro]))
  const adicionados = new Set<string>()
  const grupos = Object.entries(excursao.grupos || {})
    .map(([liderId, dependentesIds]: [string, any]) => ({
      lider: passageirosPorId.get(String(liderId)),
      dependentesIds: Array.isArray(dependentesIds) ? dependentesIds.map(String) : []
    }))
    .filter((grupo: any) => grupo.lider)
    .sort((a: any, b: any) => compararNomes(a.lider, b.lider))

  const secoes: ListaPassageiroSecao[] = grupos.map((grupo: any, index: number) => {
    const liderId = String(grupo.lider.id)
    adicionados.add(liderId)
    const lider = { ...grupo.lider, _papelGrupo: 'Titular', nomeLista: nomePassageiroLista(grupo.lider) }
    const dependentes = grupo.dependentesIds
      .map((id: string) => passageirosPorId.get(id))
      .filter((passageiro: any) => passageiro && !adicionados.has(String(passageiro.id)))
      .sort(compararNomes)
      .map((passageiro: any) => {
        adicionados.add(String(passageiro.id))
        return { ...passageiro, _papelGrupo: 'Dependente', nomeLista: nomePassageiroLista(passageiro) }
      })

    return {
      passageiros: [lider, ...dependentes],
      tipo: 'grupo' as const,
      corGrupo: (index % 2) as 0 | 1,
      numeroGrupo: index + 1
    }
  })

  const semGrupo = passageiros
    .filter((passageiro: any) => !adicionados.has(String(passageiro.id)))
    .sort(compararNomes)
    .map((passageiro: any) => ({ ...passageiro, nomeLista: nomePassageiroLista(passageiro) }))

  if (semGrupo.length || !secoes.length) {
    secoes.push({ passageiros: semGrupo, tipo: 'sem-grupo' })
  }

  return secoes
}

export function exportarListaODT(
  excursao: any,
  showToast: ToastFn,
  colunasIds?: ListaPassageiroColunaId[],
  ordenacao: ListaPassageirosOrdenacao = 'alfabetica'
) {
  try {
    const colunas = colunasLista(colunasIds)
    const secoes = secoesListaPassageiros(excursao, ordenacao)
    const mostrarColunaGrupo = ordenacao === 'grupos'
    let numeroPassageiro = 0
    const rows = secoes.map((secao) => {
      const passageirosRows = secao.passageiros.map((u: any, indexNaSecao: number) => {
        numeroPassageiro += 1
        const estiloCelula = secao.tipo === 'grupo'
          ? ` table:style-name="GroupCell${Number(secao.corGrupo || 0) + 1}"`
          : ordenacao === 'grupos' ? ' table:style-name="PlainCell"' : ''
        const estiloParagrafo = u._papelGrupo === 'Titular' ? ' text:style-name="LeaderText"' : ''
        const celulaGrupo = !mostrarColunaGrupo
          ? ''
          : secao.tipo !== 'grupo'
            ? '<table:table-cell table:style-name="PlainCell" office:value-type="string"><text:p text:style-name="GroupNumberText"></text:p></table:table-cell>'
            : indexNaSecao === 0
              ? `<table:table-cell table:style-name="GroupNumberCell${Number(secao.corGrupo || 0) + 1}" table:number-rows-spanned="${secao.passageiros.length}" office:value-type="string"><text:p text:style-name="GroupNumberText">${secao.numeroGrupo}</text:p></table:table-cell>`
              : '<table:covered-table-cell/>'
        return `
      <table:table-row>
        <table:table-cell${estiloCelula} office:value-type="string"><text:p${estiloParagrafo}>${numeroPassageiro}</text:p></table:table-cell>
        ${celulaGrupo}
        ${colunas.map((coluna) => `<table:table-cell${estiloCelula} office:value-type="string"><text:p${estiloParagrafo}>${xmlEscape(coluna.value(u, excursao))}</text:p></table:table-cell>`).join('')}
      </table:table-row>`
      }).join('')
      return passageirosRows
    }).join('')

    const legenda = ordenacao === 'grupos' ? `
    <table:table table:name="Legenda">
      <table:table-row>
        <table:table-cell table:style-name="GroupCell1" office:value-type="string"><text:p text:style-name="LegendText">Grupo - tom 1</text:p></table:table-cell>
        <table:table-cell table:style-name="GroupCell2" office:value-type="string"><text:p text:style-name="LegendText">Grupo - tom 2</text:p></table:table-cell>
        <table:table-cell table:style-name="PlainLegendCell" office:value-type="string"><text:p text:style-name="LegendText">Sem grupo - fundo padrão</text:p></table:table-cell>
      </table:table-row>
    </table:table>` : ''

    const content = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" office:version="1.2">
  <office:automatic-styles>
    <style:style style:name="h1" style:family="paragraph"><style:text-properties fo:font-size="18pt" fo:font-weight="bold"/></style:style>
    <style:style style:name="h2" style:family="paragraph"><style:text-properties fo:font-size="11pt" fo:font-weight="bold"/></style:style>
    <style:style style:name="LegendText" style:family="paragraph"><style:text-properties fo:font-size="8pt" fo:color="#596273"/></style:style>
    <style:style style:name="LeaderText" style:family="paragraph"><style:text-properties fo:font-weight="bold"/></style:style>
    <style:style style:name="GroupNumberText" style:family="paragraph"><style:paragraph-properties fo:text-align="center"/><style:text-properties fo:font-weight="bold"/></style:style>
    <style:style style:name="GroupCell1" style:family="table-cell"><style:table-cell-properties fo:background-color="#e5ecd8" fo:padding="0.05in"/></style:style>
    <style:style style:name="GroupCell2" style:family="table-cell"><style:table-cell-properties fo:background-color="#eeebff" fo:padding="0.05in"/></style:style>
    <style:style style:name="GroupNumberCell1" style:family="table-cell"><style:table-cell-properties fo:background-color="#e5ecd8" style:vertical-align="middle" fo:padding="0.05in"/></style:style>
    <style:style style:name="GroupNumberCell2" style:family="table-cell"><style:table-cell-properties fo:background-color="#eeebff" style:vertical-align="middle" fo:padding="0.05in"/></style:style>
    <style:style style:name="PlainCell" style:family="table-cell"><style:table-cell-properties fo:padding="0.05in"/></style:style>
    <style:style style:name="PlainLegendCell" style:family="table-cell"><style:table-cell-properties fo:background-color="#ffffff" fo:border="0.5pt solid #dadde5" fo:padding="0.05in"/></style:style>
  </office:automatic-styles>
  <office:body><office:text>
    <text:p text:style-name="h1">Lista de Passageiros - ${xmlEscape(excursao.nome)}</text:p>
    <text:p>Destino: ${xmlEscape(excursao.lugar || '-')}</text:p>
    <text:p>Gerado em: ${xmlEscape(new Date().toLocaleString('pt-BR'))}</text:p>
    ${legenda}
    <text:p></text:p>
    <table:table table:name="Passageiros">
      <table:table-row>
        <table:table-cell office:value-type="string"><text:p text:style-name="h2">Nº</text:p></table:table-cell>
        ${mostrarColunaGrupo ? '<table:table-cell office:value-type="string"><text:p text:style-name="h2">GRUPO</text:p></table:table-cell>' : ''}
        ${colunas.map((coluna) => `<table:table-cell office:value-type="string"><text:p text:style-name="h2">${xmlEscape(coluna.label.toUpperCase())}</text:p></table:table-cell>`).join('')}      </table:table-row>
      ${rows}
    </table:table>
  </office:text></office:body>
</office:document-content>`

    const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2">
  <manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.text"/>
  <manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>
</manifest:manifest>`

    const zipped = zipSync({
      'mimetype': strToU8('application/vnd.oasis.opendocument.text'),
      'content.xml': strToU8(content),
      'META-INF/manifest.xml': strToU8(manifest)
    }, { level: 0 })

    const blob = new Blob([zipped], { type: 'application/vnd.oasis.opendocument.text' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `Lista_${safeName(excursao.nome)}.odt`
    link.click()
    URL.revokeObjectURL(link.href)
    showToast(`Lista ODT gerada ${ordenacao === 'grupos' ? 'por grupos' : 'em ordem alfabética'}.`, 'success')
  } catch (error) {
    console.error(error)
    showToast('Erro ao gerar a lista ODT.', 'danger')
  }
}

// Mantidas para compatibilidade com versões antigas dos botões.
export async function exportarListaPDF(
  excursao: any,
  showToast: ToastFn,
  colunasIds?: ListaPassageiroColunaId[],
  ordenacao: ListaPassageirosOrdenacao = 'alfabetica'
) {
  try {
    const { jsPDF, autoTable } = await getPdfTools()
    const doc = new jsPDF()
    const colunas = colunasLista(colunasIds)
    const secoes = secoesListaPassageiros(excursao, ordenacao)
    const mostrarColunaGrupo = ordenacao === 'grupos'
    let numeroPassageiro = 0
    const body = secoes.flatMap((secao) => {
      const linhasPassageiros = secao.passageiros.map((u: any, indexNaSecao: number) => {
        numeroPassageiro += 1
        const styles = {
          ...(secao.tipo === 'grupo' ? { fillColor: CORES_GRUPOS_PDF[secao.corGrupo || 0] } : {}),
          ...(u._papelGrupo === 'Titular' ? { fontStyle: 'bold' } : {})
        }
        const celulasGrupo = !mostrarColunaGrupo
          ? []
          : secao.tipo !== 'grupo'
            ? [{ content: '', styles: { ...styles, halign: 'center', valign: 'middle' } }]
            : indexNaSecao === 0
              ? [{
                  content: String(secao.numeroGrupo),
                  rowSpan: secao.passageiros.length,
                  styles: { ...styles, halign: 'center', valign: 'middle', fontStyle: 'bold' }
                }]
              : []
        return [
          { content: String(numeroPassageiro), styles },
          ...celulasGrupo,
          ...colunas.map((coluna) => ({ content: coluna.value(u, excursao), styles }))
        ]
      })
      return linhasPassageiros
    })

    doc.setFontSize(16)
    doc.text(`Lista de Passageiros - ${excursao.nome}`, 14, 18)
    doc.setFontSize(9)
    doc.setTextColor(92, 98, 112)
    let tabelaInicioY = 31
    if (ordenacao === 'grupos') {
      doc.setFontSize(8)
      doc.text('Legenda:', 14, 32)
      doc.setFillColor(...CORES_GRUPOS_PDF[0])
      doc.rect(30, 28.5, 4, 4, 'F')
      doc.setFillColor(...CORES_GRUPOS_PDF[1])
      doc.rect(35, 28.5, 4, 4, 'F')
      doc.text('Grupos', 42, 32)
      doc.setFillColor(255, 255, 255)
      doc.setDrawColor(218, 221, 229)
      doc.rect(102, 28.5, 4, 4, 'FD')
      doc.text('Sem grupo', 109, 32)
      tabelaInicioY = 42
    }
    doc.setTextColor(0, 0, 0)
    autoTable(doc, {
      startY: tabelaInicioY,
      head: [['Nº', ...(mostrarColunaGrupo ? ['Grupo'] : []), ...colunas.map((coluna) => coluna.label)]],
      body,
      theme: 'grid',
      headStyles: { fillColor: [46, 49, 66], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 8, lineColor: [218, 221, 230], lineWidth: .15, cellPadding: 2.2 },
      rowPageBreak: 'avoid'
    })
    doc.save(`Lista_${safeName(excursao.nome)}.pdf`)
    showToast(`Lista PDF gerada ${ordenacao === 'grupos' ? 'por grupos' : 'em ordem alfabética'}.`, 'success')
  } catch (error) { console.error(error); showToast('Erro ao gerar PDF.', 'danger') }
}

export function exportarListaCSV(excursao: any, showToast: ToastFn) {
  try {
    const passageiros = passageirosOrdenados(excursao)
    let csv = '\uFEFFNº;Nome;CPF;Órgão expedidor\n'
    passageiros.forEach((u: any, index: number) => {
      csv += [index + 1, u.nomeLista || u.nome || '-', mascaraCPF(String(u.cpf || '')) || '-', u.orgaoExpeditor || '-'].join(';') + '\n'
    })
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `Lista_${safeName(excursao.nome)}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
    showToast('Lista CSV gerada.', 'success')
  } catch (error) { console.error(error); showToast('Erro ao gerar CSV.', 'danger') }
}

export async function exportarRelatorioExcursaoPDF(excursao: any, financeiro: Financeiro | null, showToast: ToastFn) {
  try {
    const { jsPDF, autoTable } = await getPdfTools()
    const doc = new jsPDF()
    const fin = financeiro || calcularFinanceiro(excursao)

    doc.setFontSize(16)
    doc.text(`Relatório da Viagem - ${excursao.nome}`, 14, 18)
    doc.setFontSize(10)
    doc.text(`Destino: ${excursao.lugar || '-'}`, 14, 25)
    doc.text(`Status: ${excursao.finalizada ? 'Finalizada' : 'Ativa'}`, 14, 31)

    autoTable(doc, {
      startY: 40,
      head: [['Indicador', 'Valor']],
      body: [
        ['Receita de passageiros', brl(fin.receita)],
        ['Gastos registrados', brl(fin.gastos)],
        ['Lucro final', brl(fin.lucro)],
        ['Passageiros vinculados', String((excursao.usuarios || []).length)],
        ['Lista de espera', String((excursao.listaEspera || []).length)]
      ]
    })

    let y = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 10 : 92
    autoTable(doc, {
      startY: y,
      head: [['Despesa', 'Valor gasto']],
      body: fin.gastosPorCategoria?.length ? fin.gastosPorCategoria.map((g) => [g.categoria, brl(g.valor)]) : [['Sem despesas registradas', brl(0)]]
    })

    y = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 10 : y + 45
    autoTable(doc, {
      startY: y,
      head: [['Passageiro', 'CPF', 'Pagamento']],
      body: passageirosOrdenados(excursao).map((u: any) => [u.nomeLista || u.nome || '-', mascaraCPF(String(u.cpf || '')) || '-', excursao.pagamentos?.[String(u.id)] || 'Pendente']),
      styles: { fontSize: 8 }
    })

    doc.save(`Relatorio_${safeName(excursao.nome)}.pdf`)
    showToast('Relatório da viagem gerado com sucesso.', 'success')
  } catch (error) {
    console.error(error)
    showToast('Erro ao gerar o relatório da viagem.', 'danger')
  }
}

export async function exportarRelatorioGeralPDF(excursoes: any[], usuarios: any[], showToast: ToastFn, meses = 12) {
  try {
    const { jsPDF, autoTable } = await getPdfTools()
    const doc = new jsPDF()
    const agora = new Date()
    const inicio = new Date(agora)
    inicio.setMonth(inicio.getMonth() - Math.max(1, Number(meses || 12)))
    const exPeriodo = excursoes.filter((ex) => {
      const data = ex.finalizadaEm || ex.createdAt
      return !data || new Date(data) >= inicio
    })

    const financeiros = exPeriodo.map((ex) => ({ ex, financeiro: calcularFinanceiro(ex) }))
    const total = financeiros.reduce((acc, item) => {
      acc.receita += item.financeiro.receita
      acc.gastos += item.financeiro.gastos
      acc.lucro += item.financeiro.lucro
      return acc
    }, { receita: 0, gastos: 0, lucro: 0 })

    const viajantes = new Set<string>()
    exPeriodo.forEach((ex) => (ex.usuarios || []).forEach((u: any) => viajantes.add(String(u.id || u.cpf))))

    doc.setFontSize(18)
    doc.text(`Relatório Geral GraziTur`, 14, 18)
    doc.setFontSize(10)
    doc.text(`Período: últimos ${meses} mês(es)`, 14, 25)
    doc.text(`Gerado em ${agora.toLocaleDateString('pt-BR')} às ${agora.toLocaleTimeString('pt-BR')}`, 14, 31)

    autoTable(doc, {
      startY: 40,
      head: [['Indicador', 'Resultado']],
      body: [
        ['Dinheiro ganho', brl(total.receita)],
        ['Dinheiro gasto', brl(total.gastos)],
        ['Lucro final', brl(total.lucro)],
        ['Excursões no período', String(exPeriodo.length)],
        ['Excursões ativas', String(exPeriodo.filter((e) => !e.finalizada).length)],
        ['Excursões finalizadas', String(exPeriodo.filter((e) => e.finalizada).length)],
        ['Usuários viajados/vinculados', String(viajantes.size)],
        ['Usuários cadastrados', String(usuarios.length)],
        ['Passeios/viagens cadastrados', String(excursoes.length)]
      ]
    })

    const y = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 10 : 102
    autoTable(doc, {
      startY: y,
      head: [['Viagem', 'Status', 'Passageiros', 'Receita', 'Gastos', 'Lucro']],
      body: financeiros.map(({ ex, financeiro }) => [
        ex.nome || '-',
        ex.finalizada ? 'Finalizada' : 'Ativa',
        String((ex.usuarios || []).length),
        brl(financeiro.receita),
        brl(financeiro.gastos),
        brl(financeiro.lucro)
      ]),
      styles: { fontSize: 8 }
    })

    doc.save(`Relatorio_Geral_GraziTur_${meses}_meses.pdf`)
    showToast('Relatório geral gerado com sucesso.', 'success')
  } catch (error) {
    console.error(error)
    showToast('Erro ao gerar o relatório geral.', 'danger')
  }
}

function dependentesDoLider(ex: any, liderId: any) {
  const deps = ex.grupos?.[String(liderId)] || []
  return (ex.usuarios || []).filter((u: any) => deps.map(String).includes(String(u.id)))
}

function assinaturaAdmin(ex: any, liderId: any) {
  return ex.assinaturas?.[`admin_${liderId}`]
}

export function gerarContratoHtml(excursao: any, lider: any) {
  const det = excursao.detalhes || {}
  const dependentes = dependentesDoLider(excursao, lider.id)
  const passageiros = [lider, ...dependentes]
  const dataCliente = brDateTime(excursao.assinaturas?.[String(lider.id)])
  const admin = assinaturaAdmin(excursao, lider.id)
  const dataAdmin = brDateTime(admin?.data || admin || new Date())
  const guiaNome = admin?.guiaNome || excursao.guia?.nome || '58.904.532 LÍVIA GRAZIELA DOS SANTOS - GRAZI TURISMO'
  const documento = [lider.rg, lider.orgaoExpeditor].filter(Boolean).join(' - ') || '_______________'
  const dependentesTexto = dependentes.length ? `<p><b>ACOMPANHANTES (DEPENDENTES):</b> ${dependentes.map((d: any) => htmlEscape(d.nome)).join(', ')}.</p>` : ''
  const valores = (excursao.valores || []).length ? (excursao.valores || []).map((v: any) => `<b>${htmlEscape(v.vezes)}x de R$ ${htmlEscape(v.valor)}</b>`).join('<br>') : 'Valores não especificados no sistema.'
  const roteiro = htmlEscape(det.roteiro || '').replace(/\n/g, '<br>') || '________________________________________________'
  const rows = passageiros.map((passageiro: any, i: number) => `<tr><td>${i + 1}</td><td>${htmlEscape(passageiro.nome)}</td><td>${htmlEscape(passageiro.nascimento || '-')}</td><td>${htmlEscape(passageiro.cpf || passageiro.rg || '-')}</td><td><b>${htmlEscape(excursao.pagamentos?.[String(passageiro.id)] || 'Pendente')}</b></td></tr>`).join('')

  return `
  <div class="contract-doc">
    <style>
      .contract-doc{font-family:Arial,Helvetica,sans-serif;font-size:10.7pt;line-height:1.55;color:#333;padding:20px}.contract-doc p{margin:0 0 10px;text-align:justify}.contract-doc .header{text-align:center;border-bottom:2px solid #2c3e50;padding-bottom:10px;margin-bottom:18px}.contract-doc h1{font-size:18pt;margin:0;color:#2c3e50;font-weight:800}.contract-doc h2{text-align:center;font-size:14pt;margin:18px 0;font-weight:500;letter-spacing:.02em}.contract-doc h3{font-size:11.5pt;color:#2c3e50;margin:16px 0 6px;font-weight:800}.contract-doc ul{margin:0 0 10px 28px}.contract-doc li{margin:2px 0}.contract-doc .box{background:#f4f6f8;border-left:4px solid #2c3e50;padding:12px 16px;margin:18px 0}.contract-doc table{width:100%;border-collapse:collapse;margin:12px 0 18px;font-size:9.5pt}.contract-doc th{background:#2c3e50;color:#fff}.contract-doc td,.contract-doc th{border:1px solid #ddd;padding:8px}.contract-doc .center{text-align:center}.contract-doc .sign{text-align:center;margin-top:34px;page-break-inside:avoid}.contract-doc .line{border-top:1px solid #000;width:62%;margin:0 auto 5px;padding-top:5px}.page-break{page-break-before:always}
    </style>
    <div class="header">
      <h1>GRAZI TURISMO</h1>
      <p class="center">CNPJ: 58.904.532/0001-33 | Cadastur: 58.904.532 LÍVIA GRAZIELA DOS SANTOS</p>
      <p class="center">Estrada Roberto Pinto de Barcelos, 01, Penha, Quissamã - RJ, CEP 28737-488</p>
    </div>
    <h2>CONTRATO DE PRESTAÇÃO DE SERVIÇOS TURÍSTICOS</h2>

    <h3>CLÁUSULA 1 - DAS PARTES</h3>
    <p><b>A) CONTRATANTE:</b><br>O(a) Sr(a). <b>${htmlEscape(lider.nome)}</b>, portador(a) do RG ${htmlEscape(documento)}, inscrito no CPF sob o nº ${htmlEscape(lider.cpf || '_______________')}, residente e domiciliado na ${htmlEscape(lider.endereco || '_______________')} - ${htmlEscape(lider.cidade || '_______________')}, celular: ${htmlEscape(lider.celular || '_______________')}.</p>
    ${dependentesTexto}
    <p><b>B) CONTRATADA:</b><br>58.904.532 LÍVIA GRAZIELA DOS SANTOS - GRAZI TURISMO, inscrita no CNPJ nº 58.904.532/0001-33, com sede na Estrada Roberto Pinto de Barcelos, 01, Penha, Quissamã - RJ, CEP 28737-488.</p>
    <p>Este Contrato é formulado à luz do Código de Defesa do Consumidor, da Deliberação Normativa da Embratur e texto da Associação Brasileira das Operadoras de Turismo - BRAZTOA.</p>
    <p>As partes acima identificadas, entre si, justo e acertado o presente Contrato dos serviços de GRAZI TURISMO, declaram ciência e concordância com as cláusulas a seguir expostas.</p>

    <h3>CLÁUSULA 2 - DAS CONDIÇÕES E OBJETO DO PRESENTE CONTRATO</h3>
    <p>O presente contrato tem como OBJETO a prestação, pela CONTRATADA, à CONTRATANTE, dos serviços na área de turismo.</p>
    <p>Os pacotes inclusos na prestação dos serviços contratados incluem a reserva e pagamento de vagas em meios de hospedagem (quando houver), transporte, contratação de serviços de recepção, transferência e assistência, segundo as especificações do pacote adquirido.</p>
    <p>A GRAZI TURISMO atua como intermediária entre seus clientes e prestadores de serviços, isentando sua responsabilidade por todo e qualquer problema resultante de casos fortuitos ou de força maior, ou seja: greves, distúrbios, quarentenas, epidemias, guerras, fenômenos naturais tais como terremotos, furacões, enchentes, avalanches, mas não limitando-se a estes, modificações, atrasos e/ou cancelamento devido a motivos técnicos, mecânicos e/ou meteorológicos, sobre os quais a operadora não possui poder de previsão ou controle.</p>

    <h3>CLÁUSULA 3 - DA CONTRATAÇÃO</h3>
    <p>Para aquisição dos serviços prestados pela GRAZI TURISMO, o contratante deverá escolher entre os valores constantes no ANEXO I do presente contrato.</p>
    <p>É lícito ao Contratante exercer seu direito de arrependimento, desistindo da contratação dos serviços, desde que o faça em até 7 (sete) dias contados da contratação, nos moldes do artigo 49 do Código de Defesa do Consumidor (com exceção das taxas/multas impostas em virtude do cancelamento, as quais serão aplicadas).</p>

    <h3>CLÁUSULA 4 - DO FINANCIAMENTO</h3>
    <p>O Contratante declara estar ciente de que, após sua solicitação e envio da documentação solicitada, será notificado. Em seguida, após a escolha do valor referente ao pacote selecionado, poderá efetuar o pagamento mediante pix, depósito, transferência bancária ou em dinheiro nos meses assim solicitado.</p>
    <p>Não incidirá nenhum tipo de juros sobre o valor a ser pago para a obtenção dos créditos, independente do número de parcelas escolhidas pelo adquirente.</p>

    <h3>CLÁUSULA 5 - DO CANCELAMENTO, DA DESISTÊNCIA E DAS TAXAS</h3>
    <p>É lícito ao CLIENTE requerer a desistência do contrato e solicitar o cancelamento em até 7 (sete) dias contados da contratação, nos moldes da cláusula 3 anteriormente descrita.</p>
    <p><b>5.1 - Condições do Cancelamento</b></p>
    <ul>
      <li>Em pedidos de RESCISÃO com mais de 30 (trinta) dias de antecedência da data do início da viagem, a multa aplicada será de 10% (dez por cento);</li>
      <li>Entre 30 (trinta) a 20 (vinte) dias de antecedência da data do início da viagem, a multa aplicada será de 20% (vinte por cento);</li>
      <li>Entre 19 (dezenove) a 15 (quinze) dias de antecedência da data do início da viagem, a multa aplicada será de 50% (cinquenta por cento);</li>
      <li>Entre 14 (quatorze) a 10 (dez) dias de antecedência da data do início da viagem, a multa aplicada será de 80% (oitenta por cento);</li>
      <li>Em caso de RESCISÃO em menos de 9 (nove) dias de antecedência da data do início da viagem, a multa aplicada será de 100% (cem por cento), e o CONTRATANTE não terá direito à restituição dos valores pagos no pacote.</li>
    </ul>
    <p><b>5.2 - Reversão do valor em crédito</b><br>Com a migração para outro pacote em valor inferior, contratação futura de novo serviço ou contratação imediata de viagem disponível dentro do valor já pago. Em caso de cancelamento com reversão do valor em créditos, o contratante terá o prazo de até 12 meses para utilizar o valor disponível.</p>
    <p><b>5.3 - RESCISÃO pela parte contratada</b><br>Caso o pacote seja cancelado pela parte contratada por não atingir o número mínimo de participantes, por condições climáticas não favoráveis ou caso surjam motivos técnicos operacionais que impeçam o cumprimento total da atividade, o CONTRATANTE poderá optar por uma das três opções: a) Agendar a mesma viagem em outra data; b) Receber 100% do valor em créditos para serem usados em uma nova compra; c) Receber 100% através de pix, depósito ou transferência bancária diretamente na conta-corrente do CONTRATANTE.</p>
    <p><b>5.4 - Da inadimplência</b><br>Caso o contratante deixe de efetuar o pagamento de algum dos meses solicitado, e não o atualize dentro do prazo do vencimento, considerar-se-á CANCELADO o pacote contratado, incidindo a partir do cancelamento pela inadimplência as regras da cláusula 5.1 quanto ao período já pago.</p>
    <p><b>5.5 - Das taxas</b><br>Todas as taxas do pacote contratado estão inclusas no valor final e serão inclusas no pacote contratado, ressalvadas: entradas a atrações turísticas que não estiverem estritamente especificadas no pacote; despesas de caráter pessoal; refeições não mencionadas, gorjetas, serviços de maleteiros. Tais despesas serão de responsabilidade exclusiva do contratante.</p>

    <h3>CLÁUSULA 6 - DA UTILIZAÇÃO DO PACOTE ADQUIRIDO</h3>
    <p>O contratante poderá utilizar o pacote adquirido SOMENTE após a quitação de todas as parcelas.</p>

    <h3>CLÁUSULA 7 - CONDIÇÕES ESPECÍFICAS E OBRIGAÇÕES DA OPERADORA</h3>
    <p><b>7.1</b> A GRAZI TURISMO atua como intermediária entre seus clientes e prestadores de serviços, conforme descrito na cláusula segunda, deste modo, a empresa contratada reserva-se o direito de promover as alterações que se fizerem necessárias quanto aos itinerários, hotéis, serviços, etc., sem prejuízo para o cliente.</p>
    <p><b>7.2 - Obriga-se a OPERADORA a:</b><br>a) Prestar informações claras e precisas ao CLIENTE, sobre o produto adquirido (dados do local de destino, hospedagens, refeições, traslados, preços, taxas e custos adicionais, dentre outros), que serão documentadas no ANEXO I.<br>b) Comunicar com antecedência de até dois dias do início dos serviços ao CLIENTE, as eventuais alterações de dias ou horários de partida e chegada das viagens; modificações de categoria de apartamentos, acomodações, quartos, cabines ou assemelhados, hotéis, pousadas e estabelecimentos afins e de quaisquer outras informações constantes.</p>
    <p><b>7.3 - DA CIÊNCIA E ACEITAÇÃO DOS RISCOS</b><br>O CONTRATANTE declara estar ciente de que atividades turísticas envolvem riscos naturais e imprevisíveis, incluindo, mas não se limitando a:</p>
    <ul><li>Afogamento em praias, rios, cachoeiras e piscinas;</li><li>Acidentes durante passeios turísticos;</li><li>Mal súbito, incluindo infarto, AVC ou outras condições médicas inesperadas;</li><li>Quedas, lesões ou qualquer outro evento decorrente da atividade turística.</li></ul>
    <p>Declara ainda que participa das atividades por livre e espontânea vontade, assumindo os riscos inerentes às atividades realizadas durante a viagem.</p>
    <p><b>7.4 - DA RESPONSABILIDADE DO CONTRATANTE</b><br>É de inteira responsabilidade do CONTRATANTE: estar em boas condições de saúde para participação nas atividades; informar previamente qualquer limitação física, doença ou condição médica relevante; seguir todas as orientações da guia, motorista e equipe responsável; zelar por sua segurança pessoal e pelos demais integrantes do grupo.</p>
    <p>A CONTRATADA não se responsabiliza por ocorrências decorrentes de imprudência, negligência ou descumprimento de orientações por parte do CONTRATANTE.</p>
    <p><b>7.5 - DO COMPORTAMENTO DO PASSAGEIRO</b><br>A CONTRATADA poderá desligar da excursão, sem direito a reembolso, o passageiro que: colocar em risco a segurança do grupo; estiver sob efeito de álcool ou substâncias que comprometam a segurança coletiva; desrespeitar normas de convivência, legislação vigente ou orientações da equipe responsável; praticar atos que comprometam o bom andamento da viagem ou a integridade física de terceiros. Neste caso, todas as despesas decorrentes do desligamento serão de responsabilidade exclusiva do CONTRATANTE.</p>
    <p><b>7.6 - DAS BAGAGENS E OBJETOS PESSOAIS</b><br>A CONTRATADA não se responsabiliza por perda, extravio, dano ou roubo de bagagens, dinheiro, documentos ou objetos pessoais durante a viagem. Recomenda-se que o CONTRATANTE mantenha seus objetos pessoais sempre sob sua guarda e responsabilidade.</p>

    <h3>CLÁUSULA 8 - SEGURO VIAGEM</h3>
    <p>A CONTRATADA informará previamente, por meio de anúncio, material informativo ou comunicação oficial, se o pacote contratado inclui ou não seguro viagem.</p>
    <p><b>§1º - Quando o seguro viagem estiver incluído no pacote:</b> A CONTRATADA responsabiliza-se pela contratação do seguro conforme as condições divulgadas, devendo fornecer ao CONTRATANTE as informações essenciais da apólice, coberturas e procedimentos de acionamento.</p>
    <p><b>§2º - Quando o seguro viagem NÃO estiver incluído no pacote:</b> A CONTRATADA recomenda expressamente a contratação de seguro viagem (assistência médica, hospitalar, odontológica, traslado médico, traslado de corpo, invalidez, morte, entre outros). O CONTRATANTE declara estar ciente de que o seguro viagem não está incluso, assumindo total responsabilidade pela sua contratação ou não, sendo de sua exclusiva responsabilidade todas as despesas decorrentes de atendimentos médicos, hospitalares, remoções, traslados, inclusive em caso de óbito, bem como quaisquer outros custos relacionados a acidentes, doenças ou eventos ocorridos durante a viagem.</p>
    <p><b>§3º - Ciência e responsabilidade do CONTRATANTE:</b> O CONTRATANTE declara que recebeu orientação prévia quanto à importância do seguro viagem, optando, por livre decisão, por sua contratação ou não.</p>
    <p><b>§4º - Limitação de responsabilidade:</b> A CONTRATADA não se responsabiliza por custos decorrentes da ausência de contratação do seguro viagem pelo CONTRATANTE, ressalvadas as hipóteses de responsabilidade previstas na legislação vigente.</p>

    <h3>CLÁUSULA 9 - DA OCORRÊNCIA DE CASOS FORTUITOS E FORÇA MAIOR</h3>
    <p>Ocorrendo caso fortuito, assim entendidos aqueles não previstos e não possíveis de serem evitados pela OPERADORA ou eventos de força maior (fenômenos da natureza, como tempestades, tufões, ciclones, enchentes, entre outros), que coloquem em risco a vida e a segurança do contratante, ou ainda situação de calamidade pública, perturbação da ordem, acidentes ou greves prejudiciais aos serviços de viagem, poderá a OPERADORA cancelar a viagem, antes do seu início ou em seu curso, sem acréscimo de multa, juros, correção ou pagamento de indenização a qualquer título.</p>
    <p>Os atrasos e os cancelamentos de trajetos motivados por razões técnicas, operacionais, mecânicas ou meteorológicas, sobre os quais a OPERADORA não possua poder de previsão ou controle, estão incluídos nos casos fortuitos ou de força maior, que a isentam de responsabilidade civil ou criminal, na forma prevista no item anterior.</p>

    <h3>CLÁUSULA 10 - MEIOS DE TRANSPORTE</h3>
    <p>Os meios de transporte específicos que serão utilizados pelo CLIENTE, na viagem ou produto que está adquirindo através deste contrato, encontram-se devida e claramente definidos e especificados no ANEXO I.</p>
    <p>O contratante declara-se ciente, por este contrato, de que a responsabilidade civil e criminal que decorra do contrato de transporte é exclusiva da empresa de transporte contratada, nos termos da legislação vigente. A OPERADORA limita-se a contratar empresas idôneas para que prestem ao(s) seu(s) CLIENTE(S) transportes rodoviário, ferroviário, marítimo, pluvial ou lacustre, na categoria turística, com o emprego de ônibus, navios, veículos, vagões, barcos etc., que devem estar em boas condições de funcionamento. Essas empresas têm responsabilidade objetiva pela segurança dos passageiros e de suas bagagens, nos termos das leis e normas específicas, obrigando-se a dispor de apólice de seguro obrigatório para o eventual ressarcimento de danos materiais e físicos.</p>

    <h3>CLÁUSULA 11 - DOCUMENTAÇÃO DE VIAGEM</h3>
    <p><b>Adultos:</b> Carteira de Identidade (RG); Carteira Nacional de Habilitação (CNH); Passaporte; Carteira de Identidade Profissional (com foto e fé pública).<br><b>Crianças e Adolescentes (até 18 anos):</b> Certidão de Nascimento (original ou cópia autenticada); Carteira de Identidade (RG); Passaporte.<br><b>Outros documentos:</b> Boletim de Ocorrência (em caso de extravio ou roubo do documento); Cópia autenticada do documento de identidade; Autorização de viagem assinada pelos pais (para menores de 16 anos, caso não estejam acompanhados dos pais).<br><b>Observações:</b> É fundamental que os documentos estejam válidos e atualizados. Não são aceitos prints ou fotos dos documentos como prova de identificação. Em caso de dúvidas ou situações específicas, é sempre recomendado consultar a empresa de transporte ou a ANTT (Agência Nacional de Transportes Terrestres). É de responsabilidade do contratante o dever de providenciar toda sua documentação de viagem.</p>

    <h3>CLÁUSULA 12 - ELEIÇÃO DE FORO</h3>
    <p>Para dirimir toda e qualquer dúvida decorrente do presente contrato, por eleição, os clientes elegem o foro da comarca de Quissamã/Carapebus/RJ, com a exclusão de qualquer outro, por mais privilegiado que o seja.</p>
    <p>O CONTRATANTE declara neste momento, ao assinar o presente contrato, ter lido e, por isso, conhecer e aceitar integralmente todas as suas cláusulas específicas e gerais, declarando, ainda, serem verdadeiras todas as informações prestadas à CONTRATADA, assumindo, de livre e espontânea vontade, todas as responsabilidades previstas neste Contrato.</p>
    <p>O presente contrato é passível de modificações antes de sua assinatura, sempre que solicitado pelo contratante, em grande e visível ambiente virtual disponível ao lado do ícone de envio do contrato.</p>

    <div class="page-break"></div>
    <div class="box"><b>O CONTRATANTE declara, para todos os fins legais, que:</b><ul><li>Leu integralmente o presente contrato;</li><li>Compreendeu todas as cláusulas nele contidas;</li><li>Está ciente dos riscos inerentes às atividades turísticas;</li><li>Assume voluntariamente a responsabilidade por sua participação nas atividades incluídas no pacote contratado;</li><li>Compromete-se a cumprir todas as orientações fornecidas pela equipe responsável pela excursão;</li><li>Declara estar em condições físicas e de saúde adequadas para participação nas atividades propostas;</li><li>Declara estar ciente de que a CONTRATADA atua como intermediadora de serviços turísticos e não executora direta dos serviços prestados por terceiros.</li></ul></div>

    <div class="page-break"></div>
    <h1 class="center">ANEXO I</h1>
    <p class="center">DESCRIÇÃO DA PRESTAÇÃO DE SERVIÇOS DA GRAZI TURISMO</p>
    <table><tr><td colspan="2"><b>Destino da viagem:</b> ${htmlEscape(excursao.lugar)}</td></tr><tr><td><b>Saída:</b> ${htmlEscape(det.dataSaida || '__/__/____')} às ${htmlEscape(det.horaSaida || '__:__')}</td><td><b>Retorno:</b> ${htmlEscape(det.dataRetorno || '__/__/____')} às ${htmlEscape(det.horaRetorno || '__:__')}</td></tr><tr><td colspan="2"><b>Transporte:</b> ${htmlEscape(det.transporte || '_________________')} &nbsp; | &nbsp; <b>Empresa:</b> ${htmlEscape(det.empresa || '_________________')}</td></tr></table>
    <h3>DADOS DO RECEPTIVO E SERVIÇOS PRESTADOS</h3><p>${roteiro}</p>
    <h3>VALORES DO PACOTE</h3><p>${valores}</p>
    <h3>DADOS DOS PASSAGEIROS E PAGAMENTOS ACORDADOS</h3><table><thead><tr><th>Nº</th><th>NOME COMPLETO</th><th>NASCIMENTO</th><th>DOCUMENTO</th><th>PAGAMENTO</th></tr></thead><tbody>${rows}</tbody></table>
    <p><b>DECLARAÇÃO FINAL:</b> O CONTRATANTE declara que leu, compreendeu e concorda com todas as cláusulas acima, especialmente quanto aos riscos envolvidos e responsabilidades assumidas.</p>
    <p class="center" style="margin-top:32px">Quissamã/RJ, ${new Date().toLocaleDateString('pt-BR')}</p>
    <div class="sign"><div class="line"></div><p class="center"><b>CONTRATANTE: ${htmlEscape(lider.nome)}</b><br><small>Assinado digitalmente em: ${htmlEscape(dataCliente || 'Pendente')}</small></p></div>
    <div class="sign"><div class="line"></div><p class="center"><b>${htmlEscape(guiaNome)}</b><br><small>Assinado digitalmente em: ${htmlEscape(dataAdmin || 'Pendente')}</small></p></div>
  </div>`
}

export async function gerarContratoAssinadoPDF(excursao: any, userId: number | string, showToast: ToastFn) {
  let wrapper: HTMLDivElement | null = null

  try {
    const lider = (excursao.usuarios || []).find((u: any) => String(u.id) === String(userId))
    if (!lider) { showToast('Passageiro não encontrado na excursão.', 'danger'); return }

    showToast('Gerando contrato assinado...', 'warning')

    if (!(window as any).html2pdf) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script')
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js'
        script.onload = () => resolve()
        script.onerror = () => reject(new Error('Falha ao carregar gerador de PDF.'))
        document.head.appendChild(script)
      })
    }

    wrapper = document.createElement('div')
    wrapper.className = 'pdf-contract-wrapper'
    wrapper.style.position = 'fixed'
    wrapper.style.left = '-10000px'
    wrapper.style.top = '0'
    wrapper.style.width = '210mm'
    wrapper.style.minHeight = '297mm'
    wrapper.style.background = '#ffffff'
    wrapper.style.zIndex = '-1'
    wrapper.innerHTML = gerarContratoHtml(excursao, lider)
    document.body.appendChild(wrapper)

    const doc = wrapper.querySelector('.contract-doc') as HTMLElement | null
    if (doc) {
      doc.style.width = '190mm'
      doc.style.maxWidth = '190mm'
      doc.style.margin = '0 auto'
      doc.style.padding = '12mm'
      doc.style.background = '#ffffff'
      doc.style.color = '#222222'
      doc.style.boxShadow = 'none'
      doc.style.border = '0'
      doc.style.borderRadius = '0'
    }

    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))

    const opt = {
      margin: [8, 8, 8, 8],
      filename: `Contrato_${safeName(lider.nome)}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        letterRendering: true,
        scrollX: 0,
        scrollY: 0
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'legacy'], before: ['.page-break'] }
    }

    await (window as any).html2pdf().set(opt).from(doc || wrapper).save()
    showToast('Contrato baixado.', 'success')
  } catch (e) {
    console.error(e)
    showToast('Erro ao gerar contrato. Tente novamente ou baixe pelo painel administrativo.', 'danger')
  } finally {
    wrapper?.remove()
  }
}
