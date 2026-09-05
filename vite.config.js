import {defineConfig} from 'vite';
export default defineConfig({root:'dist',server:{host:'0.0.0.0',allowedHosts:['terminal.local']}});
