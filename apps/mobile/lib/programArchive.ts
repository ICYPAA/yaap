import { withDeviceId } from './supabase'

export type ArchivedProgram = {
  id: number
  title: string
  start_date: string
  end_date: string
}

export function isPastIcypaa(program: ArchivedProgram, currentId: number | null, now = new Date()) {
  return /\bICYPAA\b/i.test(program.title) && program.id !== currentId &&
    program.end_date.slice(0, 10) < now.toISOString().slice(0, 10)
}

// Called only when the user opens the picker; event data is never prefetched.
export async function loadArchiveCatalog(currentId: number | null): Promise<ArchivedProgram[]> {
  const client = await withDeviceId()
  const { data, error } = await client.from('programs')
    .select('id,title,start_date,end_date')
    .ilike('title', '%ICYPAA%')
    .lt('end_date', new Date().toISOString().slice(0, 10))
    .order('start_date', { ascending: false })
  if (error) throw error
  return (data || []).filter(program => isPastIcypaa(program, currentId))
}
