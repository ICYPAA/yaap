import {getRequestConfig} from 'next-intl/server';
import { headers } from 'next/headers';

export default getRequestConfig(async () => {
  // Provide a static locale, fetch a user setting,
  // read from `cookies()`, `headers()`, etc.
  const localeFromHeader = (await headers()).get('accept-language');
  const availableLocales = [ 'en', 'es', 'so', 'hmn' ];

  let locale: string = 'en';

  if (localeFromHeader) {
    const preferredLocales = localeFromHeader.split(',').map(l => {
      const [ preferredLocale, qualityStr ] = l.split(';') as [string, string | undefined];
      const quality = qualityStr ? parseFloat(qualityStr.split('=')[1]) : 1;

      return {
        preferredLocale,
        quality
      }
    }).sort((a, b) => b.quality - a.quality);

    for (const { preferredLocale } of preferredLocales) {
      if (availableLocales.includes(preferredLocale)) {
        locale = preferredLocale;
        break;
      }
    }
  }

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default
  };
});