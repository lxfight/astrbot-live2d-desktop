declare module 'earcut' {
  const earcut: (data: number[] | number[][], holeIndices?: number[], dim?: number) => number[]
  export default earcut
  export { earcut }
}
