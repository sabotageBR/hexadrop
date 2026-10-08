/**
 * O backend nativo do app: a unica parte de src/app/ que fala com os plugins.
 *
 * Tudo aqui e mecanica crua - carregar, mostrar, gravar evento, comprar. A
 * politica (quando mostrar, quanto esperar, o que vale como premio) mora em
 * nativo.js, anuncios.js e compras.js, e e a mesma sobre o backend simulado
 * (simulado.js), que tem exatamente este formato. E assim que a automacao
 * (tools/appcheck.mjs) confere a politica no navegador, sem aparelho.
 *
 * Formato:
 * - `plataforma`: 'android' | 'ios'
 * - `agora()`, `escondido()`
 * - `ads`: consentir, abrirPrivacidade, rastreamento, iniciar, carregar, mostrar, ouvir
 * - `analytics`: evento, propriedade, consentimento
 * - `loja`: suportada, preco, compras, comprar, reconhecer, restaurar
 * - `ciclo`: ouvir, minimizar, esconderSplash, esconderBarras
 */

import { Capacitor, SystemBars } from '@capacitor/core';
import { App } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import {
  AdMob,
  AdmobConsentStatus,
  InterstitialAdPluginEvents,
  MaxAdContentRating,
  RewardAdPluginEvents,
} from '@capacitor-community/admob';
import { FirebaseAnalytics, ConsentStatus, ConsentType } from '@capacitor-firebase/analytics';
import { NativePurchases, PURCHASE_TYPE } from '@capgo/native-purchases';
import { unidades } from './config.js';

/**
 * Estado de uma compra, nas duas lojas. No Android o Play Billing devolve
 * `purchaseState` "1" (comprado) ou "2" (pendente: pagamento em dinheiro, por
 * exemplo); no iOS so vem o que esta valendo, e reembolso traz `revocationDate`.
 * @param {*} t
 * @returns {'comprado'|'pendente'|'outro'}
 */
function estadoDe(t) {
  if (!t) return 'outro';
  if (t.revocationDate) return 'outro';
  if (t.purchaseState === undefined || t.purchaseState === null) return 'comprado';
  const s = String(t.purchaseState);
  return s === '1' ? 'comprado' : s === '2' ? 'pendente' : 'outro';
}

/** @returns {*} */
export function criarBackendNativo() {
  const plataforma = Capacitor.getPlatform();
  const ids = unidades(plataforma);
  /** @type {Record<string, string>} */
  const unidade = { intersticial: ids.intersticial, recompensado: ids.recompensado };

  return {
    nome: 'nativo',
    plataforma,
    agora: () => Date.now(),
    escondido: () => typeof document !== 'undefined' && document.hidden,

    ads: {
      /**
       * UMP: pede a informacao de consentimento e, se a lei pedir e houver
       * formulario, mostra. Repetido a cada abertura, como a Google manda.
       */
      async consentir() {
        let info = await AdMob.requestConsentInfo({ tagForUnderAgeOfConsent: false });
        if (info.status === AdmobConsentStatus.REQUIRED && info.isConsentFormAvailable) {
          info = await AdMob.showConsentForm();
        }
        return {
          status: String(info.status),
          podePedir: !!info.canRequestAds,
          // O enum PrivacyOptionsRequirementStatus nao e exportado pelo plugin.
          privacidadeObrigatoria: String(info.privacyOptionsRequirementStatus) === 'REQUIRED',
        };
      },
      abrirPrivacidade: () => AdMob.showPrivacyOptionsForm(),
      /** ATT do iOS, depois do UMP. No Android resolve sem fazer nada. */
      async rastreamento() {
        if (plataforma !== 'ios') return;
        const { status } = await AdMob.trackingAuthorizationStatus();
        if (status === 'notDetermined') await AdMob.requestTrackingAuthorization();
      },
      iniciar: () =>
        AdMob.initialize({
          tagForUnderAgeOfConsent: false,
          maxAdContentRating: MaxAdContentRating.ParentalGuidance,
        }),
      /** @param {'intersticial'|'recompensado'} tipo */
      async carregar(tipo) {
        const adId = unidade[tipo];
        if (!adId) throw new Error('sem unidade de anuncio para ' + tipo);
        // immersiveMode: o jogo esconde as barras do sistema, e o anuncio por
        // cima nao pode faze-las voltar.
        if (tipo === 'intersticial') await AdMob.prepareInterstitial({ adId, immersiveMode: true });
        else await AdMob.prepareRewardVideoAd({ adId, immersiveMode: true });
      },
      /** @param {'intersticial'|'recompensado'} tipo */
      async mostrar(tipo) {
        if (tipo === 'intersticial') await AdMob.showInterstitial();
        else await AdMob.showRewardVideoAd();
      },
      /**
       * @param {(evento:'abriu'|'falhou-mostrar'|'fechou'|'premio', tipo:'intersticial'|'recompensado')=>void} fn
       */
      ouvir(fn) {
        const I = InterstitialAdPluginEvents;
        const R = RewardAdPluginEvents;
        AdMob.addListener(I.Showed, () => fn('abriu', 'intersticial'));
        AdMob.addListener(I.FailedToShow, () => fn('falhou-mostrar', 'intersticial'));
        AdMob.addListener(I.Dismissed, () => fn('fechou', 'intersticial'));
        AdMob.addListener(R.Showed, () => fn('abriu', 'recompensado'));
        AdMob.addListener(R.FailedToShow, () => fn('falhou-mostrar', 'recompensado'));
        AdMob.addListener(R.Dismissed, () => fn('fechou', 'recompensado'));
        AdMob.addListener(R.Rewarded, () => fn('premio', 'recompensado'));
      },
    },

    analytics: {
      /**
       * @param {string} nome
       * @param {Record<string, string|number>} params
       */
      evento(nome, params) {
        FirebaseAnalytics.logEvent({ name: nome, params }).catch(() => {});
      },
      /**
       * @param {string} chave
       * @param {string} valor
       */
      propriedade(chave, valor) {
        FirebaseAnalytics.setUserProperty({ key: chave, value: valor }).catch(() => {});
      },
      /**
       * Consent Mode v2. O manifesto e o Info.plist ja nascem com `ad_*` negado;
       * aqui so se concede quando o UMP diz que a lei nao pede consentimento. Com
       * consentimento obtido pelo formulario, o Firebase le a decisao sozinho
       * das strings TCF que o UMP grava, e nao se deve sobrescrever.
       * @param {boolean} concedido
       */
      consentimento(concedido) {
        const status = concedido ? ConsentStatus.Granted : ConsentStatus.Denied;
        for (const type of [ConsentType.AdStorage, ConsentType.AdUserData, ConsentType.AdPersonalization]) {
          FirebaseAnalytics.setConsent({ type, status }).catch(() => {});
        }
      },
    },

    loja: {
      async suportada() {
        const { isBillingSupported } = await NativePurchases.isBillingSupported();
        return !!isBillingSupported;
      },
      /** @param {string} id */
      async preco(id) {
        const { products } = await NativePurchases.getProducts({
          productIdentifiers: [id],
          productType: PURCHASE_TYPE.INAPP,
        });
        const p = products && products[0];
        return p && p.priceString ? p.priceString : null;
      },
      /**
       * @param {string} id
       * @returns {Promise<Array<{estado:string, token?:string, reconhecida?:boolean}>>}
       */
      async compras(id) {
        const { purchases } = await NativePurchases.getPurchases({
          productType: PURCHASE_TYPE.INAPP,
          onlyCurrentEntitlements: true,
        });
        return (purchases || [])
          .filter((p) => p.productIdentifier === id)
          .map((p) => ({ estado: estadoDe(p), token: p.purchaseToken, reconhecida: p.isAcknowledged }));
      },
      /**
       * @param {string} id
       * @returns {Promise<'ok'|'pendente'|'cancelado'|'erro'>}
       */
      async comprar(id) {
        try {
          const t = await NativePurchases.purchaseProduct({
            productIdentifier: id,
            productType: PURCHASE_TYPE.INAPP,
            isConsumable: false,
          });
          const e = estadoDe(t);
          return e === 'comprado' ? 'ok' : e === 'pendente' ? 'pendente' : 'erro';
        } catch (err) {
          const msg = String((err && /** @type {*} */ (err).message) || err);
          if (/pending/i.test(msg)) return 'pendente';
          if (/cancel/i.test(msg)) return 'cancelado';
          return 'erro';
        }
      },
      /** @param {string} token */
      reconhecer: (token) => NativePurchases.acknowledgePurchase({ purchaseToken: token }),
      restaurar: () => NativePurchases.restorePurchases(),
    },

    ciclo: {
      /** @param {(evento:'voltar'|'pausa'|'volta')=>void} fn */
      ouvir(fn) {
        // Com um ouvinte de backButton o Capacitor deixa de fechar o app sozinho:
        // quem decide o que o voltar faz em cada tela e o jogo.
        App.addListener('backButton', () => fn('voltar'));
        App.addListener('pause', () => fn('pausa'));
        App.addListener('resume', () => fn('volta'));
      },
      minimizar() {
        if (plataforma === 'android') App.minimizeApp().catch(() => {});
      },
      esconderSplash() {
        SplashScreen.hide({ fadeOutDuration: 250 }).catch(() => {});
      },
      esconderBarras() {
        SystemBars.hide().catch(() => {});
      },
    },
  };
}
