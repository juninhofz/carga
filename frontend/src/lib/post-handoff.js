// CARGA: what the share sheet hands to the challenge post screen (views/Challenges.jsx PostCheckin):
// which activity ('w-<workout id>' or 'r-<run id>') and the picture made for it. Taken once.
let pending = null
export const handOff = v => { pending = v }
export const takeHandOff = () => { const v = pending; pending = null; return v }
