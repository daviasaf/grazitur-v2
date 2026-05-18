export const onlyDigits = (v: string | number | null | undefined) => String(v || '').replace(/\D/g, '')

export const mascaraCPF = (v: string) => {
  let cpf = onlyDigits(v).slice(0, 11)
  cpf = cpf.replace(/(\d{3})(\d)/, '$1.$2')
  cpf = cpf.replace(/(\d{3})(\d)/, '$1.$2')
  cpf = cpf.replace(/(\d{3})(\d{1,2})$/, '$1-$2')
  return cpf
}

export const mascaraData = (v: string) => {
  let data = onlyDigits(v).slice(0, 8)
  if (data.length >= 5) return data.replace(/(\d{2})(\d{2})(\d{1,4})/, '$1/$2/$3')
  if (data.length >= 3) return data.replace(/(\d{2})(\d{1,2})/, '$1/$2')
  return data
}

export const mascaraHora = (v: string) => {
  let hora = onlyDigits(v).slice(0, 4)
  if (hora.length > 2) return hora.replace(/(\d{2})(\d{1,2})/, '$1:$2')
  return hora
}

export const mascaraRG = (v: string) => {
  const rg = onlyDigits(v).slice(0, 9)
  if (rg.length < 9) return rg
  return rg.replace(/(\d{2})(\d{3})(\d{3})(\d{1})$/, '$1.$2.$3-$4')
}

export const mascaraCelular = (v: string) => {
  const fone = onlyDigits(v).slice(0, 11)
  if (fone.length <= 2) return fone ? `(${fone}` : ''
  if (fone.length <= 6) return fone.replace(/(\d{2})(\d+)/, '($1) $2')
  if (fone.length <= 10) return fone.replace(/(\d{2})(\d{4})(\d+)/, '($1) $2-$3')
  return fone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
}

export const moneyToNumber = (input: string | number | null | undefined) => {
  if (typeof input === 'number') return Number.isFinite(input) ? input : 0

  let value = String(input || '').trim()
  if (!value) return 0

  value = value.replace(/R\$/gi, '').replace(/\s/g, '')

  const hasComma = value.includes(',')
  const hasDot = value.includes('.')

  if (hasComma && hasDot) {
    if (value.lastIndexOf(',') > value.lastIndexOf('.')) {
      value = value.replace(/\./g, '').replace(',', '.')
    } else {
      value = value.replace(/,/g, '')
    }
  } else if (hasComma) {
    value = value.replace(/\./g, '').replace(',', '.')
  } else {
    const dotCount = (value.match(/\./g) || []).length
    if (dotCount > 1) value = value.replace(/\./g, '')
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export const mascaraDinheiro = (v: string | number) => {
  const digits = onlyDigits(v).slice(0, 12)
  if (!digits) return ''
  const cents = digits.padStart(3, '0')
  const inteiro = cents.slice(0, -2)
  const decimal = cents.slice(-2)
  const inteiroFormatado = Number(inteiro).toLocaleString('pt-BR')
  return `${inteiroFormatado},${decimal}`
}

export const validarCPF = (cpfRaw: string) => {
  const cpf = onlyDigits(cpfRaw)
  if (!cpf || cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false
  let soma = 0
  for (let i = 1; i <= 9; i++) soma += Number(cpf.substring(i - 1, i)) * (11 - i)
  let resto = (soma * 10) % 11
  if (resto === 10 || resto === 11) resto = 0
  if (resto !== Number(cpf.substring(9, 10))) return false
  soma = 0
  for (let i = 1; i <= 10; i++) soma += Number(cpf.substring(i - 1, i)) * (12 - i)
  resto = (soma * 10) % 11
  if (resto === 10 || resto === 11) resto = 0
  return resto === Number(cpf.substring(10, 11))
}

export const brl = (valor: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(valor || 0))

export const formatarNome = (nome: string) => {
  if (!nome) return ''
  const preps = ['da', 'de', 'di', 'do', 'du', 'das', 'dos', 'e']
  return nome
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((p) => (preps.includes(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(' ')
}
