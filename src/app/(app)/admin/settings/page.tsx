import SettingsPanel from '@/components/admin/SettingsPanel'

export default function AdminSettingsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-1">AI Model Settings</h1>
      <p className="text-sm text-[var(--color-text-muted)] mb-6">Configure default AI models per feature</p>
      <SettingsPanel />
    </div>
  )
}
