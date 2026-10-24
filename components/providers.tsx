'use client';

import { CSPProvider } from '@base-ui/react/csp-provider';
import { createContext, type ReactNode, useContext } from 'react';
import type { ClientConfig } from '@/lib/env';
import { Toaster } from './ui/toast';

const ConfigContext = createContext<ClientConfig | null>(null);

export function useClientConfig(): ClientConfig {
  const config = useContext(ConfigContext);
  if (!config) throw new Error('ClientConfig missing');
  return config;
}

/** App-wide client context: public config, CSP nonce for Base UI, toasts. */
export function Providers({
  config,
  nonce,
  children,
}: {
  config: ClientConfig;
  nonce: string | undefined;
  children: ReactNode;
}) {
  return (
    <ConfigContext value={config}>
      <CSPProvider nonce={nonce}>
        {children}
        <Toaster />
      </CSPProvider>
    </ConfigContext>
  );
}
