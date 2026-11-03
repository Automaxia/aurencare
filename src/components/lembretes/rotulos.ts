import type { TipoLembrete } from '@/server/services/lembretes'

/** Rótulos dos lembretes (compartilhado entre perfil e ficha do paciente). */
export const ROTULO_LEMBRETE: Record<TipoLembrete, { titulo: string; detalhe: string }> = {
  lembrete24h: {
    titulo: 'Véspera (~24h antes)',
    detalhe: 'WhatsApp + e-mail, com CONFIRMAR ou CANCELAR',
  },
  lembrete2h: {
    titulo: '2 horas antes',
    detalhe: 'Só WhatsApp',
  },
  lembrete15min: {
    titulo: '15 minutos antes',
    detalhe: 'Desligado, a sessão online ainda recebe o link da sala',
  },
}
