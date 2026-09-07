jest.mock('../supabase', () => ({ withDeviceId: jest.fn() }))
import { isPastIcypaa, loadArchiveCatalog } from '../programArchive'
import { withDeviceId } from '../supabase'

const now = new Date('2026-09-07T18:00:00Z')
const program = { id: 66, title: '66th ICYPAA', start_date: '2026-09-03', end_date: '2026-09-06' }
it('includes completed ICYPAAs and excludes HACYPAA, current, and future programs', () => {
  expect(isPastIcypaa(program, null, now)).toBe(true)
  expect(isPastIcypaa({ ...program, title: 'HACYPAA' }, null, now)).toBe(false)
  expect(isPastIcypaa(program, 66, now)).toBe(false)
  expect(isPastIcypaa({ ...program, end_date: '2027-09-06' }, null, now)).toBe(false)
})
it('does not contact Supabase until the catalog is explicitly requested, and fetches metadata only', async () => {
  expect(withDeviceId).not.toHaveBeenCalled()
  const query: any = { select: jest.fn(), ilike: jest.fn(), lt: jest.fn(), order: jest.fn().mockResolvedValue({ data: [program], error: null }) }
  for (const key of ['select', 'ilike', 'lt']) query[key].mockReturnValue(query)
  const from = jest.fn().mockReturnValue(query)
  ;(withDeviceId as jest.Mock).mockResolvedValue({ from })
  await loadArchiveCatalog(null)
  expect(from).toHaveBeenCalledTimes(1)
  expect(from).toHaveBeenCalledWith('programs')
  expect(query.select).toHaveBeenCalledWith('id,title,start_date,end_date')
})
