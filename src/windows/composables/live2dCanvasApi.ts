export interface Live2DCanvasApi {
  getModelOverlayBounds?: () => {
    anchorX: number
    topCenterY: number
    bottomCenterY: number
  } | null
  startLipSync?: (audioElement: HTMLAudioElement) => void
  stopLipSync?: () => void
}
