import ReactDOM from 'react-dom/client'
import { App } from './app/providers'
import './i18n/config'

/**
 * Main React entry point.
 *
 * Runtime configuration and the global stylesheet are loaded earlier in `bootstrap.ts` so the
 * theme renders before this async chunk downloads; this file only mounts the app tree.
 */
ReactDOM.createRoot(document.getElementById('root')!).render(
  <App />,
)
