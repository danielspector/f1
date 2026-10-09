export function raceIdentity(race: { name: string; circuit: string }): string {
  const name = race.name.trim().toLowerCase()
  const circuit = race.circuit.trim().toLowerCase()
  // Jolpica now uses Lusail; existing calendars used Losail for the same venue.
  const canonicalCircuit =
    circuit === 'losail international circuit' ? 'lusail international circuit' : circuit
  return JSON.stringify([name, canonicalCircuit])
}
