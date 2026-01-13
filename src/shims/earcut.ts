import earcutCjs from '../../node_modules/earcut/src/earcut.js'

// earcut 是 CJS：module.exports = earcut，同时也写了 module.exports.default = earcut
// 这里统一提供 ESM 的 default + 具名导出，给 @pixi/utils 使用
export default earcutCjs
export const earcut = earcutCjs
