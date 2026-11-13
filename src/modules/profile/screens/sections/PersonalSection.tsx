import { useRef } from 'react'
import { NumInput, Tile, TextInput } from '../../../../shared/components/fields'
import { Button } from '../../../../shared/components/ui'
import { ageOf, calcAge, resizeImage } from '../../../../shared/services/profileService'
import { useStore } from '../../../../store'

export function PersonalSection() {
  const { profile, updateProfile, setCurrentWeight, weight, showToast } = useStore()
  const file = useRef<HTMLInputElement>(null)
  const derived = calcAge(profile.birthDate)
  return (
    <>
      <TextInput label="Nombre" value={profile.name} onChange={(v) => updateProfile({ name: v })} placeholder="¿Cómo te llamas?" />
      <div className="grid grid-cols-2 gap-3">
        <TextInput label="Fecha de nacimiento" type="date" value={profile.birthDate ?? ''} onChange={(v) => updateProfile({ birthDate: v || undefined })} />
        {derived !== undefined ? (
          <Tile label="Edad" hint="Calculada automáticamente"><div className="num text-[26px] font-bold">{derived} <span className="text-mute text-sm">años</span></div></Tile>
        ) : (
          <NumInput label="Edad" unit="años" value={profile.ageManual} max={110} onChange={(n) => updateProfile({ ageManual: n })} hint="Añade tu fecha de nacimiento y se calculará sola" />
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <NumInput label="Altura" unit="cm" value={profile.heightCm} max={250} onChange={(n) => updateProfile({ heightCm: n })} />
        <NumInput label="Peso actual" unit="kg" decimal deferred value={weight} max={400} onChange={(n) => { setCurrentWeight(n); if (n !== undefined) showToast('Peso guardado en tu historial') }} hint="Se añade a tu historial corporal" />
      </div>
      <NumInput label="Peso objetivo" unit="kg" decimal value={profile.targetWeightKg} max={400} onChange={(n) => updateProfile({ targetWeightKg: n })} />
      <div>
        <input ref={file} type="file" accept="image/*" className="hidden" onChange={async (e) => {
          const f = e.target.files?.[0]; e.target.value = ''
          if (!f) return
          try { updateProfile({ photo: await resizeImage(f, 480) }); showToast('Foto guardada solo en este dispositivo') } catch { showToast('No se pudo leer la imagen') }
        }} />
        <div className="flex gap-2">
          <Button variant="secondary" size="md" className="flex-1" onClick={() => file.current?.click()}>{profile.photo ? 'Cambiar foto' : 'Añadir foto de perfil'}</Button>
          {profile.photo && <Button variant="danger" size="md" onClick={() => updateProfile({ photo: undefined })}>Quitar</Button>}
        </div>
        <p className="text-[12px] text-dim mt-2 leading-snug">La foto es opcional, se reduce y se guarda únicamente en tu dispositivo.</p>
      </div>
      <p className="text-[12px] text-dim leading-snug">Edad {ageOf(profile) ?? '—'} · {profile.heightCm ?? '—'} cm · {weight ?? '—'} kg. Todos los datos son editables en cualquier momento.</p>
    </>
  )
}
