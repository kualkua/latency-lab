import './tracing-init'; // must be first
import { createApp } from './app';

const port = Number(process.env.PORT ?? 3000);

createApp().listen(port, () => {
  console.log(`latency-lab listening on port ${port}: /fast /tail /blocking /metrics`);
});
