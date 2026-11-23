// This file must be imported FIRST in server.ts: the instrumentation patches http/express
// only if it is enabled before those modules are loaded.
import { startTracing } from './tracing';

startTracing();
