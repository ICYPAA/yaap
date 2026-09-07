// Change this checked-in default after each conference, or set YAAP_BRANDING
// on an EAS build. Keep generic as the permanent, reusable fallback.
const defaultBrand = 'generic'
const brands = {
  generic: {
    icon: './assets/branding/icypaa-generic/icon.png',
    adaptiveIcon: { foregroundImage: './assets/branding/icypaa-generic/icon.png', backgroundColor: '#263869' },
    favicon: './assets/branding/icypaa-generic/icon.png'
  },
  'icypaa-66': {
    icon: './assets/images/icon.png',
    adaptiveIcon: {
      foregroundImage: './assets/images/adaptive-icon.png',
      backgroundImage: './assets/images/adaptive-icon-background.png',
      monochromeImage: './assets/images/adaptive-icon-monochrome.png',
      backgroundColor: '#fa6a1b'
    },
    favicon: './assets/images/favicon.png'
  }
}
const name = process.env.YAAP_BRANDING || defaultBrand
if (!brands[name]) throw new Error(`Unknown YAAP_BRANDING: ${name}`)
module.exports = { name, ...brands[name] }
