declare module 'stellar-identicon-js' {
  const createStellarIdenticon: (
    stellarAddress: string,
    options?: { width?: number; height?: number },
  ) => HTMLCanvasElement
  export default createStellarIdenticon
}
