// providers/index.mjs — provider kayıt defteri.
// Tüm marketplace provider'ları burada kayıt edilir; search-urls ve agent akışları
// provider listesini buradan alır.

import { registerProvider, listProviders, getProvider } from './base.mjs';
import { SahibindenProvider } from './sahibinden.mjs';
import { ArabamProvider } from './arabam.mjs';
import { VavacarsProvider } from './vavacars.mjs';
import { OtokocProvider } from './otokoc.mjs';

let initialized = false;

export function initProviders() {
  if (initialized) return listProviders();
  registerProvider(SahibindenProvider);
  registerProvider(ArabamProvider);
  registerProvider(VavacarsProvider);
  registerProvider(OtokocProvider);
  initialized = true;
  return listProviders();
}

export function allProviders() {
  return initProviders();
}

export function providerById(id) {
  initProviders();
  return getProvider(id);
}

/** Tüm providerların filtre kapsama raporu (hangi filtre nerede uygulanıyor) */
export function filterMatrix() {
  const providers = initProviders();
  const matrix = {};
  for (const p of providers) {
    const caps = p.capabilities();
    matrix[p.id] = {
      label: p.label,
      verified: p.spec.verified,
      url_filters: caps.native,
      url_filters_unverified: caps.native_unverified,
      postfilters: caps.postfilter.length,
      unsupported: caps.unsupported,
      coverage: p.coverage(),
    };
  }
  return matrix;
}

export { getProvider, listProviders };
