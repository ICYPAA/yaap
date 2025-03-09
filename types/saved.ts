export type SavedItem = {
  id: number
  title: string
  time: string
  date: string
  location: string
  type: "speaker" | "panel" | "entertainment"
}

export type SavedItemsState = {
  items: SavedItem[]
  addItem: (item: SavedItem) => void
  removeItem: (id: number) => void
}
