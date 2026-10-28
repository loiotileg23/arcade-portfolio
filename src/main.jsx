import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// StrictMode intentionally omitted: it triggers double-mount in dev,
// which would create two Phaser game instances.
createRoot(document.getElementById('root')).render(<App />)
