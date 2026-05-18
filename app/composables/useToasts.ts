export const useToasts = () => {
  const toasts = useState<Array<{ id: number; message: string; type: string }>>('toasts', () => [])

  const showToast = (message: string, type = 'success') => {
    const id = Date.now() + Math.random()
    toasts.value.push({ id, message, type })
    setTimeout(() => {
      toasts.value = toasts.value.filter((t) => t.id !== id)
    }, 3800)
  }

  const removerToast = (id: number) => {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }

  return { toasts, showToast, removerToast }
}
