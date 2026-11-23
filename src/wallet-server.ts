import './tracing-init'; // must be first
import { createWalletApp } from './wallet';

const port = Number(process.env.PORT ?? 3000);

createWalletApp().listen(port, () => {
  console.log(`wallet listening on port ${port}: /balance /metrics`);
});
