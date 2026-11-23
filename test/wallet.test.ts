import { AddressInfo } from 'node:net';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { createHttpWallet } from '../src/wallet-client';
import { createWalletApp } from '../src/wallet';

const noSleep = async () => {};
const servers: { close: () => void }[] = [];

function listen(app: ReturnType<typeof createWalletApp>) {
  const server = app.listen(0);
  servers.push(server);
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

afterEach(() => {
  servers.splice(0).forEach((s) => s.close());
});

describe('wallet service', () => {
  it('/balance returns the balance and a slow-response flag', async () => {
    const app = createWalletApp({ sleep: noSleep, random: () => 0.01 });
    const res = await request(app).get('/balance').expect(200);
    expect(res.body).toEqual({ balance: 100, slow: true });
  });
});

describe('/tail via the wallet HTTP client', () => {
  it('gets a response from a real wallet service over the network', async () => {
    const url = listen(createWalletApp({ sleep: noSleep, random: () => 0.01 }));
    const app = createApp({ wallet: createHttpWallet(url) });

    const res = await request(app).get('/tail').expect(200);
    expect(res.body.slow).toBe(true);
  });

  it('if wallet is unavailable, responds 502 instead of hanging', async () => {
    const url = listen(createWalletApp());
    servers.splice(0).forEach((s) => s.close()); // port is closed
    const app = createApp({ wallet: createHttpWallet(url, fetch, 500) });

    const res = await request(app).get('/tail').expect(502);
    expect(res.body.ok).toBe(false);
  });

  it('if wallet responds with an error, /tail responds 502', async () => {
    const failing = vi.fn(async () => new Response('boom', { status: 500 })) as unknown as typeof fetch;
    const app = createApp({ wallet: createHttpWallet('http://wallet', failing) });

    await request(app).get('/tail').expect(502);
  });
});
