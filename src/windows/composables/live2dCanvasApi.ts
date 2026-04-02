export interface Live2DCanvasApi {
  disablePassThrough?: () => void
  enablePassThrough?: () => void
  getModelOverlayBounds?: () => {
    anchorX: number
    topCenterY: number
    bottomCenterY: number
  } | null
  startLipSync?: (audioElement: HTMLAudioElement) => void
  stopLipSync?: () => void
}
