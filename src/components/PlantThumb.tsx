import { useEffect, useState } from 'react'
import { LeafIcon } from './Icons'

export function PlantThumb({ photo, big = false }: { photo: Blob | null; big?: boolean }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!photo) { setUrl(null); return }
    const u = URL.createObjectURL(photo)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [photo])
  const cls = `thumb${big ? ' big' : ''}`
  return url ? <img className={cls} src={url} alt="" /> : <div className={cls}><LeafIcon /></div>
}
