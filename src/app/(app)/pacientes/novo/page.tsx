import { PageHeader } from '@/components/PageHeader'
import { requirePsicologo } from '@/server/lib/auth'
import { NewPatientForm } from './form'

export const dynamic = 'force-dynamic'

export default async function NovoPacientePage() {
  const user = await requirePsicologo()
  return (
    <div>
      <PageHeader
        title="Novo paciente"
        subtitle="Cadastro mínimo. Será enviado um WhatsApp com link de consentimento."
      />

      <div style={{
        display: 'flex', gap: 11, alignItems: 'flex-start',
        padding: '13px 15px', marginBottom: 16, borderRadius: 12,
        background: 'rgba(176,125,64,.08)', border: '1px solid rgba(176,125,64,.22)',
      }}>
        <span style={{ fontSize: 16, lineHeight: 1.2 }}>📲</span>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: '#7a5520', marginBottom: 3 }}>
            O consentimento vem primeiro
          </div>
          <div style={{ fontSize: 12, color: '#9a7030', lineHeight: 1.55 }}>
            Ao salvar, o paciente recebe um link de consentimento por WhatsApp e precisa
            aceitar os termos (LGPD · CFP) antes que você consiga completar o restante do
            cadastro — dados clínicos e demais informações. Até lá, ele aparece como{' '}
            <strong>“Aguardando consentimento”</strong>.
          </div>
        </div>
      </div>

      <NewPatientForm psicologoNome={user.name ?? 'quem vai te atender'} />
    </div>
  )
}
