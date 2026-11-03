// CARGA on the web without a server (VITE_LOCAL_WEB=1, the Vercel deployment): like the demo
// (lib/demo.js) it boots straight into guest mode with everything kept on the device, but starts
// empty. Nothing that needs the backend (sign-in, sync, server integrations) is offered. A module
// of its own, so the suites that mock lib/demo.js keep working unchanged.
export const LOCAL_WEB = (import.meta.env || {}).VITE_LOCAL_WEB === '1'
