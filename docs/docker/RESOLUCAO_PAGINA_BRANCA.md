# 🔧 Resolução: Página em branco no Docker (React/Vite)

## Sintomas
- HTTP `200` em `http://localhost:8080/`, mas a página fica em branco
- Console do navegador com erros:
  - `Uncaught TypeError: s.jsxDEV is not a function`
  - `ReferenceError: React is not defined`
- Container NGINX saudável e servindo `dist/`, mas o bundle trava na inicialização

## Causa
- O bundle de produção foi gerado contendo chamadas de `jsxDEV` (runtime de desenvolvimento do JSX), que não existe no ambiente de produção.
- Com isso, o runtime não encontra `jsxDEV`/`React` adequado e a inicialização falha.

## Diagnóstico Rápido
- Verificar se o bundle contém `jsxDEV`:
  - PowerShell:
    ```powershell
    Select-String -Path "j:\Protegido\queren2\querenhapuque\dist\assets\index-*.js" -Pattern "jsxDEV" -CaseSensitive | Measure-Object | Select-Object -ExpandProperty Count
    ```
  - Se o número for > 0, o build está usando runtime de dev.
- Conferir `index.html` aponta para o JS correto:
  ```powershell
  Get-Content "j:\Protegido\queren2\querenhapuque\dist\index.html" | Select-String -Pattern "<script.*index-.*\.js"
  ```
- Validar container:
  ```powershell
  docker ps --format "{{.Names}} | {{.Image}} | {{.Status}} | {{.Ports}}"
  docker logs querenhapuque-local --tail 100
  ```

## Correção
1. Ajustar build para produção (sem `jsxDEV`):
   - `vite.config.ts` com React + runtime automático e `jsxDev=false`:
     ```ts
     import { defineConfig } from "vite";
     import react from "@vitejs/plugin-react-swc";
     import path from "path";

     export default defineConfig(({ mode }) => ({
       server: { host: "::", port: 8082, strictPort: false, watch: { ignored: ["**/_node_modules_old/**", "**/backups/**"] } },
       plugins: [react({ jsxDev: false })],
       resolve: { alias: [{ find: '@', replacement: path.resolve(__dirname, 'src') }] },
       esbuild: { jsx: 'automatic', jsxDev: false },
       define: { 'process.env.NODE_ENV': JSON.stringify(mode) },
     }));
     ```
   - Garantir build em modo produção:
     ```powershell
     $env:NODE_ENV='production'
     npm run build
     ```
2. Apontar `index.html` para o novo asset gerado:
   ```powershell
   (Get-Content "j:\Protegido\queren2\querenhapuque\dist\index.html") -replace "/assets/index-.*\.js","/assets/index-<NOVO_HASH>.js" | Set-Content "j:\Protegido\queren2\querenhapuque\dist\index.html"
   ```
   - Substitua `<NOVO_HASH>` pelo nome real (ex.: `index-453e0ae1.js`).
3. Reiniciar o container local (bind mount reflete o `dist/`):
   ```powershell
   docker restart querenhapuque-local
   ```

## Validação
- Checar que não há `jsxDEV` no bundle novo:
  ```powershell
  Select-String -Path "j:\Protegido\queren2\querenhapuque\dist\assets\index-*.js" -Pattern "jsxDEV" -CaseSensitive | Measure-Object | Select-Object -ExpandProperty Count
  ```
  - Resultado esperado: `0`.
- Acessar `http://localhost:8080/?cachebust=<NOVO_HASH>` para forçar recarregar o asset.
- Console sem erros e página renderizando normalmente.

## Observações
- O container NGINX deve montar `dist/` em read-only: `-v j:\Protegido\queren2\querenhapuque\dist:/usr/share/nginx/html:ro`.
- Sempre rode o build com `NODE_ENV=production`.
- Se houver Service Worker ou cache agressivo, use querystring `?cachebust=` ou limpe o cache do navegador.
- Não armazenar segredos no repositório; configure variáveis de ambiente no Coolify/CIs.

## Comandos úteis
```powershell
# Status Docker
docker info --format '{{.ServerVersion}} | {{.OperatingSystem}} | {{.Swarm.LocalNodeState}}'
docker ps --format '{{.Names}} | {{.Image}} | {{.Status}} | {{.Ports}}'

# Build produção
$env:NODE_ENV='production'; npm run build

# Atualiza referência do asset no index.html
(Get-Content "j:\\Protegido\\queren2\\querenhapuque\\dist\\index.html") -replace "/assets/index-.*\\.js","/assets/index-<NOVO_HASH>.js" | Set-Content "j:\\Protegido\\queren2\\querenhapuque\\dist\\index.html"

# Reinicia container
docker restart querenhapuque-local
```