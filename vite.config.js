import {defineConfig} from 'vite';
import {localEvidencePlugin} from './scripts/local-evidence-server.mjs';
export default defineConfig({root:'app',plugins:[localEvidencePlugin()],server:{host:'0.0.0.0',allowedHosts:['terminal.local']}});
