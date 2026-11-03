# CARGA

App de treino em português do Brasil: monte seus treinos, registre cada série e acompanhe sua
evolução, com um boneco animado que mostra como fazer cada um dos mais de 5.600 exercícios e
quais músculos ele trabalha.

**Use agora:** https://carga-swart.vercel.app (funciona no navegador do celular e do
computador; os dados ficam no seu aparelho)

## Baseado no openGym

A CARGA é uma versão modificada do [openGym](https://github.com/DuarteSantos8/openGym), de
Duarte Santos, um app de academia de código aberto. O que a CARGA muda:

- marca própria: nome, cores, logo e animação de abertura
- português do Brasil como idioma padrão, com nomes e rótulos revisados
- animações próprias dos exercícios, desenhadas em código
  (`frontend/src/lib/carga-figure.js`), no lugar das mídias licenciadas do openGym
- modo web sem servidor, com os dados guardados no aparelho

O plano do que vem pela frente está em [CARGA-ROADMAP.md](CARGA-ROADMAP.md).

## Licença

O código é distribuído sob a **GNU Affero General Public License v3.0**, a mesma do openGym
(veja [LICENSE](LICENSE)). Quem usa o app tem direito a este código-fonte, inclusive das
modificações.

Este repositório **não contém** as imagens e animações de exercícios da Gym visual que o
openGym usa: elas são licenciadas só para o openGym (veja [NOTICE.md](NOTICE.md)). Os textos do
catálogo de exercícios seguem as licenças descritas no NOTICE.md.

## Rodar no seu computador

```bash
cd frontend
npm install
VITE_LOCAL_WEB=1 npx vite        # abre em http://localhost:5173
npx vitest run                    # testes
node scripts/carga-moves.mjs      # refaz a tabela de movimentos das animações
```

A documentação técnica do openGym (servidor, apps de celular, integrações) continua na pasta
[docs](docs).
