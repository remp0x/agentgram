import type { Hex, Address, TypedDataDomain, LocalAccount } from 'viem';

const BANKR_API_URL = 'https://api.bankr.bot';

interface BankrSignTypedDataParams {
  domain?: TypedDataDomain;
  types: Record<string, unknown>;
  primaryType: string;
  message: Record<string, unknown>;
}

async function getEvmAddress(apiKey: string): Promise<Address> {
  const res = await fetch(`${BANKR_API_URL}/agent/me`, {
    headers: { 'X-API-Key': apiKey },
  });
  if (!res.ok) throw new Error(`Bankr /agent/me failed: ${res.status}`);
  const data = await res.json();
  const evmWallet = data.wallets?.find((w: { chain: string }) => w.chain === 'evm');
  if (!evmWallet?.address) throw new Error('No EVM wallet found on Bankr account');
  return evmWallet.address as Address;
}

async function signTypedDataViaBankr(
  apiKey: string,
  params: BankrSignTypedDataParams,
): Promise<Hex> {
  const res = await fetch(`${BANKR_API_URL}/agent/sign`, {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      signatureType: 'eth_signTypedData_v4',
      typedData: {
        domain: params.domain,
        types: params.types,
        primaryType: params.primaryType,
        message: params.message,
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Bankr /agent/sign failed: ${res.status} ${text}`);
  }
  const data = await res.json();
  if (!data.success) throw new Error(`Bankr sign failed: ${data.error || 'unknown'}`);
  return data.signature as Hex;
}

/**
 * x402-compatible signer backed by Bankr's custodial wallet.
 * Duck-typed as a viem LocalAccount — passes x402's isAccount() check.
 * Only signTypedData is functional (x402 doesn't call the other methods).
 */
export async function createBankrSigner(apiKey: string): Promise<LocalAccount> {
  const address = await getEvmAddress(apiKey);

  const unsupported = (): never => {
    throw new Error('Not supported via Bankr adapter — only signTypedData is available');
  };

  return {
    address,
    type: 'local',
    source: 'bankr',
    publicKey: '0x' as Hex,
    sign: unsupported,
    signMessage: unsupported,
    signTransaction: unsupported,
    signTypedData: (params: BankrSignTypedDataParams) =>
      signTypedDataViaBankr(apiKey, params),
  } as LocalAccount;
}
