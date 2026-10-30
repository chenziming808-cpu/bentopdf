// 阿搜PDF工具箱 brand helper. The site is a modified version of BentoPDF
// (AGPL-3.0, https://github.com/alam00000/bentopdf).
export const BRAND_NAME_ZH = '阿搜PDF工具箱';
export const BRAND_NAME_EN = 'Asou PDF Toolbox';

export function getBrandName(): string {
  const lang =
    (typeof document !== 'undefined' && document.documentElement.lang) || '';
  return lang.toLowerCase().startsWith('zh') ? BRAND_NAME_ZH : BRAND_NAME_EN;
}
