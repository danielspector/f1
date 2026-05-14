const TEAM_COLORS: Record<string, string> = {
  'Red Bull': '#3671C6',
  Ferrari: '#E8002D',
  Mercedes: '#27F4D2',
  McLaren: '#FF8000',
  'Aston Martin': '#229971',
  Alpine: '#FF87BC',
  Williams: '#64C4FF',
  Audi: '#FF4C3B',
  'Racing Bulls': '#6692FF',
  Haas: '#B6BABD',
  Cadillac: '#C0C0C0',
}

export function teamColor(teamName: string | null | undefined): string {
  if (!teamName) return '#6b6b6b'
  for (const [key, color] of Object.entries(TEAM_COLORS)) {
    if (teamName.includes(key)) return color
  }
  return '#6b6b6b'
}
