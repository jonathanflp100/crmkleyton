import React, { useEffect, useState } from 'react';
import { Download, Share, X, PlusSquare } from 'lucide-react';

/**
 * Banner "Instalar app" (PWA).
 * - Android / Chrome / Edge: usa o evento beforeinstallprompt e instala com um toque.
 * - iPhone / iPad (Safari): não existe botão automático, então mostra o passo a passo.
 * Some quando o app já está instalado ou quando a pessoa fecha (lembra por 7 dias).
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'gp_install_dismissed_at';
const DISMISS_DAYS = 7;

function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
}

function isIOS(): boolean {
  const ua = window.navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) || (ua.includes('Mac') && 'ontouchend' in document);
}

function recentlyDismissed(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return at > 0 && Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOS, setShowIOS] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (isStandalone() || recentlyDismissed()) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setHidden(false);
    };
    const onInstalled = () => {
      setDeferred(null);
      setHidden(true);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);

    if (isIOS()) {
      setShowIOS(true);
      setHidden(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* navegador sem storage: só esconde */
    }
    setHidden(true);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    setDeferred(null);
    if (choice.outcome === 'accepted') setHidden(true);
  };

  if (hidden || (!deferred && !showIOS)) return null;

  return (
    <div className="no-print fixed inset-x-3 bottom-3 z-[60] sm:left-auto sm:right-4 sm:bottom-4 sm:w-96">
      <div className="rounded-2xl border border-slate-700 bg-slate-900/95 p-4 text-white shadow-2xl backdrop-blur">
        <div className="flex items-start gap-3">
          <img src="/icons/icon-192.png" alt="" className="h-11 w-11 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">Instalar o Gestor Pro</p>
            {deferred ? (
              <p className="mt-0.5 text-xs text-slate-300">
                Use como aplicativo no celular ou no computador, com ícone na tela inicial.
              </p>
            ) : (
              <p className="mt-0.5 text-xs leading-relaxed text-slate-300">
                No Safari, toque em <Share className="inline h-3.5 w-3.5 -mt-0.5" /> <strong>Compartilhar</strong> e
                depois em <PlusSquare className="inline h-3.5 w-3.5 -mt-0.5" />{' '}
                <strong>Adicionar à Tela de Início</strong>.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Fechar"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {deferred && (
          <button
            type="button"
            onClick={install}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-bold hover:bg-blue-500"
          >
            <Download className="h-4 w-4" /> Instalar aplicativo
          </button>
        )}
      </div>
    </div>
  );
}
